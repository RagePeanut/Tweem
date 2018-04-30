const Twit = require('twit');
const steemStream = require('steem');
const steemRequest = require('steem');

const { request_nodes, settings, steem_accounts, stream_nodes, tweet_retry_timeout } = require('./config');

const twitter = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

// The current tweet length limit is at 280 characters
const MAX_TWEET_LENGTH = 280;
// Twitter automatically replaces links by https://t.co/[A-Za-z\d]{10}
const LINK_LENGTH = 23;

steemRequest.api.setOptions({ url: request_nodes[0] });

// Launching the stream function
stream();

// Streams steem operations, this function is recursive (it calls itself when the stream fails)
function stream() {
    // Setting the RPC node link based on the current index value
    steemStream.api.setOptions({ url: stream_nodes[0] });
    return new Promise((resolve, reject) => {
        console.log('Starting a new stream with ' + stream_nodes[0]);
        // Starting the steem operations stream
        steemStream.api.streamOperations((err, operation) => {
            // Errors are mostly caused by RPC nodes crashing
            if(err) return reject(err);
            // Resteems are inside custom_json operations
            if(settings.tweet_resteems && operation[0] === 'custom_json') {
                const op = JSON.parse(operation[1].json);
                // Checking if it's a resteem and if it's from one of the specified accounts
                if(op[0] === 'reblog' && steem_accounts.includes(op[1].account)) {
                    treatOperation(op[1].author, op[1].permlink, op[0]);
                }
            // Checking if it's a post (not a comment) made by one of the specified accounts
            } else if(settings.tweet_posts && operation[0] === 'comment' && steem_accounts.includes(operation[1].author) && operation[1].parent_author === '') {
                treatOperation(operation[1].author, operation[1].permlink, operation[0]);
            }
        });
    // If an error occured, add 1 to the index and put it at 0 if it is out of bound
    // Then relaunch the stream since it crashed
    }).catch(err => {
        console.error('Stream error:', err.message, 'with', stream_nodes[0]);
        // Putting the node element at the end of the array
        stream_nodes.push(stream_nodes.shift());
        stream();
    });
}

// Tweets the content of the message
function tweet(message) {
    twitter.post('statuses/update', { status: message }, (err, data, response) => {
        if(err) {
            // The tweet already exists
            if(err.code === 187) console.error('Error: The tweet \'' + message + '\' already exists');
            // Retry if it's another error
            else {
                console.error('Unknown error:', err.message);
                console.log('Please notify @ragepeanut of the encountered error so it doesn\'t happen to other users')
                console.log('Retrying...');
                setTimeout(tweet, tweet_retry_timeout, message);
            }
        } else console.log('Successfully tweeted', message);
    });
}

// Gets the website from which the post has been made if it can view posts
function getWebsite(app, author, permlink, url, tags, body) {
    // If the app is steemit or linking to posts on the app is not allowed/supported, the post is treated as a steemit post
    // Apps that get a steemit.com link: steemit, chainbb, esteem, masdacs, steemauto, steempress, postpromoter, Steem Harry Games, vote-buyer, steemjs, piston-lib, undefined
    // The list of supported apps is manually updated. If an app is missing, please contact me through any of the means specified in the README file or send a new issue
    if(!settings.allowed_links[app]) return 'steemit.com' + url;
    switch(app) {
        case 'fundition':
            return 'fundition.io/#!/@' + author + '/' + permlink;
        case 'busy':
            return 'busy.org/@' + author + '/' + permlink;
        case 'utopian':
            return 'utopian.io' + url;
        case 'dtube':
            return 'd.tube/#!/v/' + author + '/' + permlink;
        case 'dsound':
            return 'dsound.audio/#!/@' + author + '/' + permlink;
        case 'dmania':
            return 'dmania.lol/post/' + author + '/' + permlink;
        case 'zappl':
            return 'zappl.com/' + url.split('/')[1] + '/' + author + '/' + permlink;
        case 'steepshot':
            return 'alpha.steepshot.io/post/@' + author + '/' + permlink;
        case 'steemhunt':
            return 'steemhunt.com/@' + author + '/' + permlink;
        case 'parley':
            return 'parley.io/thread/' + author + '/' + permlink;
        case 'steemkr':
            return 'steemkr.com' + url;
        case 'bescouted':
            // Bescouted links don't follow the Steem apps logic, therefore the link has to be fetched from the body
            // If the user removed the website link, the post is treated as a steemit post
            return body.match(/\(?:https:\/\/www\.(bescouted\.com\/photo\/\d{8,}\/[\w-]+\/\d{8,})\/\)/)[0] || 'steemit.com' + url;
        case 'dlive':
            // Links for videos and livestreams don't have the same structure, the only way to check which one the post is is to check the post tags
            // DLive automatically transforms livestream links to video links when accessed once the livestream ended so the app doesn't have to check for that
            if(tags.includes('dlive-broadcast')) return 'dlive.io/livestream/' + author + '/' + permlink;
            if(tags.includes('dlive-video')) return 'dlive.io/video/' + author + '/' + permlink;
            // If the user changed the identifying tag, the post is treated as a steemit post
        default:
            return 'steemit.com' + url;
    }
}

function treatOperation(author, permlink, type) {
    return new Promise((resolve, reject) => {
        // Getting the content of the post
        steemRequest.api.getContent(author, permlink, (err, result) => {
            if(err) return reject(err);
            // If the operation is a comment operation, it must be a post creation, not a post update
            else if(type === 'reblog' || type === 'comment' && result.last_update === result.created) {
                let metadata;
                try {
                    metadata = JSON.parse(result.json_metadata);
                    if(!metadata) throw new Error('The metadata is ', metadata);
                    if(typeof metadata !== 'object') throw new Error('The metadata is of type ' + typeof metadata);
                } catch(err) {
                    return reject(err);
                }
                let message = '';
                // Title
                if(settings.include_title) {
                    // Mentions
                    // If set to true, completely removes the mentions in the title (e.g. 'Hello @ragepeanut !' --> 'Hello !')
                    if(settings.mentions.remove_mentions) result.title = result.title.replace(/( )?@[a-zA-Z0-9._-]+( )?/g, (match, firstSpace, secondSpace) => { return firstSpace || secondSpace});
                    // If set to true, removes the @ character from mentions (e.g. 'Bye @ragepeanut !' --> 'Bye ragepeanut !')
                    else if(settings.mentions.remove_mentions_at_char) result.title = result.title.replace(/@([a-zA-Z0-9._-]+)/g, '$1');
                    // If set to true, escapes a mention if it is the first word of the title (e.g. '@ragepeanut isn\'t a real peanut :O' --> '.@ragepeanut isn\'t an real peanut :O')
                    else if(settings.mentions.escape_starting_mention && result.title[0] === '@') result.title = '.' + result.title;
                    message += result.title + ' ';
                }
                // Tags
                if(settings.include_tags) {
                    let tags = metadata.tags || [result.category];
                    // If set to true, removes any duplicate tag from the tags array
                    if(settings.tags.check_for_duplicate) {
                        const tmpTags = [];
                        tags.forEach(tag => {
                            if(!tmpTags.includes(tag)) tmpTags.push(tag);
                        });
                        tags = tmpTags;
                    }
                    // If set to an integer, takes only the X first tags
                    if(settings.tags.limit) tags = tags.slice(0, settings.tags.limit);
                    // Unshifting to put a # character in front of the first tag
                    tags.unshift('');
                    message += tags.reduce((accumulator, tag) => accumulator + '#' + tag + ' ');
                    // Checking if the message is going to be longer than the maximum length
                    if(message.length + LINK_LENGTH > MAX_TWEET_LENGTH) {
                        tags.shift();
                        let neededLength = message.length + LINK_LENGTH - MAX_TWEET_LENGTH;
                        // If set to true, removes tags by order of importance (last tag removed first)
                        if(settings.tags.remove_tags_by_order) {
                            for(let i = tags.length - 1; i >= 0 && neededLength > 0; i--) {
                                message = message.replace('#' + tags[i] + ' ', '');
                                neededLength -= tags[i].length + 2;
                            }
                        // If set to true, removes tags by the opposite order of importance (first tag removed first)
                        } else if(settings.tags.remove_tags_by_order_opposite) {
                            for(let i = 0; i < tags.length && neededLength > 0; i++) {
                                message = message.replace('#' + tags[i] + ' ', '');
                                neededLength -= tags[i].length + 2;
                            }
                        // If set to true, removes tags by length (smallest removed first)
                        } else if(settings.tags.remove_tags_by_length) {
                            tags = tags.sort((a, b) => a.length - b.length);
                            for(let i = 0; i < tags.length && neededLength > 0; i++) {
                                message = message.replace('#' + tags[i] + ' ', '');
                                neededLength -= tags[i].length + 2;
                            }
                        // If set to true, removes tags by length (longest removed first)
                        } else if(settings.tags.remove_tags_by_length_opposite) {
                            tags = tags.sort((a, b) => b.length - a.length);
                            for(let i = 0; i < tags.length && neededLength > 0; i++) {
                                message = message.replace('#' + tags[i] + ' ', '');
                                neededLength -= tags[i].length + 2;
                            }
                        }
                    }
                }
                // If the message is too long, trims the title
                if(message.length + LINK_LENGTH > MAX_TWEET_LENGTH) {
                    let neededLength = message.length + LINK_LENGTH - MAX_TWEET_LENGTH;
                    message = message.replace(result.title, result.title.substr(0, result.title.length - neededLength - 3) + '...');
                }
                // First parameter (app): checking for all the known ways of specifying an app, if none of them exists the app is set to undefined
                message += getWebsite(metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined, result.author, result.permlink, result.url, metadata.tags, result.body);
                tweet(message);
            }
        });
    }).catch(err => {
        console.error('Error:', err.message, 'with', request_nodes[0]);
        // Putting the node element at the end of the array
        request_nodes.push(request_nodes.shift());
        steemRequest.api.setOptions({ url: request_nodes[0] });
        console.log('Retrying with', request_nodes[0]);
        treatOperation(author, permlink, type);
    });
}