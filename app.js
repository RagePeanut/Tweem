const Twit = require('twit');
const steemStream = require('steem');
const steemRequest = require('steem');

const { request_nodes, settings, steem_accounts, stream_nodes, tweet_retry_timeout, twitter_handle } = require('./config');

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
                if(op[0] === 'reblog' && steem_accounts.resteems.includes(op[1].account)) {
                    treatOperation(op[1].author, op[1].permlink, op[0]);
                }
            // Checking if it's a post (not a comment) made by one of the specified accounts
            } else if(settings.tweet_posts && operation[0] === 'comment' && steem_accounts.posts.includes(operation[1].author) && operation[1].parent_author === '') {
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
function tweet(message, url) {
    // Checking if the link has already been included in a tweet from this account
    isAlreadyTweeted(url)
        .then(alreadyTweeted => {
            if(!alreadyTweeted) {
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
            } else console.log('A tweet with the same link has already been sent.');
        })
        .catch(err => {
            console.err('Twitter Search API Error:', err.message);
            console.log('Retrying...');
            setTimeout(tweet, tweet_retry_timeout, message, url);
        });
}

// Checks if the link has already been tweeted in the last 7 days
// This function is still a prototype and may resolve to false with some already tweeted links
function isAlreadyTweeted(url) {
    // The Twitter Search API is a mess, can't handle the @ character
    const urlAllowedParts = url.split('@');
    return new Promise(resolve => {
        const query = { q: 'url:' + urlAllowedParts[urlAllowedParts.length - 1], count: 100, result_type: 'recent' };
        twitter.get('search/tweets', query, (err, data, response) => {
            if(err) reject(err);
            else resolve(data.statuses.some(tweet => tweet.user.screen_name === twitter_handle));
        });
    });
}

// Gets the website from which the post has been made if it can view posts
function getWebsite(app, author, permlink, url, tags, body) {
    if(!settings.allowed_apps[app]) return null;
    else if(settings.allowed_apps[app] === 1) app = settings.default_app;
    switch(app) {
        case 'bescouted':
            // Bescouted links don't follow the Steem apps logic, therefore the link has to be fetched from the body
            // If the user removed the website link, the post is treated as a steemit post
            return body.match(/\(?:https:\/\/www\.(bescouted\.com\/photo\/\d{8,}\/[\w-]+\/\d{8,})\/\)/)[0] || 'steemit.com' + url;
        case 'blockdeals':
            return 'blockdeals.org' + url;
        case 'busy':
            return 'busy.org/@' + author + '/' + permlink;
        case 'dlive':
            // Links for videos and livestreams don't have the same structure, the only way to check which one the post is is to check the post tags
            // DLive automatically transforms livestream links to video links when accessed once the livestream ended so the app doesn't have to check for that
            if(tags.includes('dlive-broadcast')) return 'dlive.io/livestream/' + author + '/' + permlink;
            if(tags.includes('dlive-video')) return 'dlive.io/video/' + author + '/' + permlink;
            // If the user changed the identifying tag, the post is treated as a steemit post
        case 'dsound':
            return 'dsound.audio/#!/@' + author + '/' + permlink;
        case 'dtube':
            return 'd.tube/#!/v/' + author + '/' + permlink;
        case 'fundition':
            return 'fundition.io/#!/@' + author + '/' + permlink;
        case 'hede':
            return 'hede.io' + url;
        case 'insteem':
            return 'www.insteem.com/stories/' + author + '/' + permlink;
        case 'memeit.lol':
            return 'memeit.lol/@' + author + '/' + permlink;
        case 'mTasks':
            return 'steemmtask.herokuapp.com/@' + author + '/' + permlink;
        case 'oneplace':
            return 'oneplace.media/s/@' + author + '/' + permlink;
        case 'parley':
            return 'parley.io/thread/' + author + '/' + permlink;
        case 'steemd':
            return 'steemd.com' + url;
        case 'steemdb':
            return 'steemdb.com' + url;
        case 'steemhunt':
            return 'steemhunt.com/@' + author + '/' + permlink;
        case 'steemkr':
            return 'steemkr.com' + url;
        case 'steemthink':
            return 'steemthink.com/#!/detail/' + author + '/' + permlink;
        case 'steepshot':
            return 'alpha.steepshot.io/post/@' + author + '/' + permlink;
        case 'utopian':
            return 'utopian.io' + url;
        case 'zappl':
            return 'zappl.com/' + url.split('/')[1] + '/' + author + '/' + permlink;
        // If the app specified in settings.default_app doesn't exist, doesn't support viewing posts, isn't yet supported or isn't correctly written, use Steemit for the link
        // Apps that get a steemit.com link: steemit, dbooks, chainbb, esteem, masdacs, steemauto, steempress, postpromoter, Steem Harry Games, vote-buyer, steemjs, piston-lib, undefined
        // The list of supported apps is manually updated. If an app is missing, please contact me through any of the means specified in the README file or send a new issue
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
                // First parameter (app): checking for all the known ways of specifying an app, if none of them exists the app is set to undefined
                const website = getWebsite(metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined, result.author, result.permlink, result.url, metadata.tags, result.body);
                // If tweeting has been allowed for posts from this website
                if(website) {
                    const regex = /{{([^{]+)::(\d+)}}|%%(.+)::(\d+)%%/g;
                    const message = {
                        by: {
                            content: '',
                            importance: 0
                        },
                        tags: {
                            arr: [],
                            content: '',
                            importance: 0
                        },
                        title: {
                            content: '',
                            importance: 0
                        }
                    }
                    let messageLength = LINK_LENGTH + settings.template.replace(regex, '').length;
                    let match;
                    while(match = regex.exec(settings.template)) {
                        switch(match[1] || match[3]) {
                            case 'tags':
                                message.tags.importance = parseInt(match[2]);
                                let tags = metadata.tags || [match.category];
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
                                message.tags.arr = tags;
                                message.tags.content = tags.map(tag => '#' + tag).join(' ');
                                messageLength += message.tags.content.length;
                                break;
                            case 'title':
                                message.title.importance = parseInt(match[2]);
                                message.title.content = result.title;
                                // Mentions
                                // If set to true, completely removes the mentions in the title (e.g. 'Hello @ragepeanut !' --> 'Hello !')
                                if(settings.mentions.remove_mentions) message.title.content = message.title.content.replace(/( )?@[a-zA-Z0-9._-]+( )?/g, (match, firstSpace, secondSpace) => firstSpace || secondSpace);
                                // If set to true, removes the @ character from mentions (e.g. 'Bye @ragepeanut !' --> 'Bye ragepeanut !')
                                else if(settings.mentions.remove_mentions_at_char) message.title.content = message.title.content.replace(/@([a-zA-Z0-9._-]+)/g, '$1');
                                // If set to true, escapes a mention if it is the first word of the title (e.g. '@ragepeanut isn\'t a real peanut :O' --> '.@ragepeanut isn\'t an real peanut :O')
                                else if(settings.mentions.escape_starting_mention && message.title.content[0] === '@') message.title.content = '.' + message.title.content;
                                messageLength += message.title.content.length;
                                break;
                            default:
                                message.by.importance = parseInt(match[4]);
                                if(type === 'reblog') {
                                    message.by.content = match[3].replace(/{{([^{]+)}}/g, (match, variable) => {
                                        try {
                                            return eval(variable);
                                        } catch(err) {
                                            console.error('Error: the variable \'' + variable + '\' doesn\'t exist. Treating it as a string.');
                                            return '{{' + variable + '}}';
                                        }
                                    });
                                    messageLength += message.by.content.length;
                                }
                        }
                    };
                    const leastToMostImportant = Object.keys(message).sort((a, b) => message[b].importance < message[a].importance);
                    while(messageLength > MAX_TWEET_LENGTH && leastToMostImportant.length > 0) {
                        const part = leastToMostImportant.shift();
                        let neededLength = messageLength - MAX_TWEET_LENGTH;
                        switch(part) {
                            case 'by':
                                messageLength -= message.by.content.length;
                                message.by.content = '';
                                break;
                            case 'tags':
                                let removalOrder = message.tags.arr.slice(0);
                                // If set to true, removes tags by order of importance (last tag removed first)
                                if(settings.tags.remove_tags_by_order) removalOrder.reverse();
                                // If set to true, removes tags by length (smallest removed first)
                                else if(settings.tags.remove_tags_by_length) removalOrder.sort((a, b) => a.length - b.length);
                                // If set to true, removes tags by length (longest removed first)
                                else if(settings.tags.remove_tags_by_length_opposite) removalOrder.sort((a, b) => b.length - a.length);
                                // If set to true, removes tags by the opposite order of importance (first tag removed first)
                                // If set to false, don't remove any tag
                                else if(!settings.tags.remove_tags_by_order_opposite) removalOrder = [];
                                while(neededLength > 0 && removalOrder.length > 0) {
                                    const toRemove = removalOrder.shift();
                                    message.tags.arr.splice(message.tags.arr.findIndex(tag => tag === toRemove), 1);
                                    messageLength -= message.tags.content.length;
                                    message.tags.content = message.tags.arr.map(tag => '#' + tag).join(' ');
                                    messageLength += message.tags.content.length;
                                    neededLength = messageLength - MAX_TWEET_LENGTH;
                                }
                                break;
                            default:
                                message.title.content = message.title.content.substr(0, message.title.content.length - neededLength - 3) + '...';
                                messageLength -= neededLength;
                                break;
                        }
                    }
                    const tweetContent = (settings.template.replace(/%%.+%%/g, message.by.content)
                                                           .replace(/{{([^{]+)::\d+}}/g, (match, content) => message[content].content) + ' ' + website)
                                                           .replace(/  +/g, ' ');
                    tweet(tweetContent, website);
                }
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