const Twit = require('twit');
const steemStream = require('steem');
const steemRequest = require('steem');

const parser = require('./utils/parser');

const { personal_steem_accounts, request_nodes, settings, steem_accounts, stream_nodes, template, tweet_retry_timeout, twitter_handle } = require('./config');

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

// Sending tweets with a specified delay between them
const tweetStack = [];
let tweetsInterval = setInterval(() => {
    if(tweetStack[0]) {
        // Making sure that no tweet is sent while processing this one
        clearInterval(tweetsInterval);
        const [message, url] = tweetStack.shift();
        tweet(message, url);
    }
}, settings.tweet_frequency_minutes * 60 * 1000);

steemRequest.api.setOptions({ url: request_nodes[0] });

stream();

/** Streams steem operations */
function stream() {
    // Setting the RPC node link based on the current index value
    steemStream.api.setOptions({ url: stream_nodes[0] });
    new Promise((resolve, reject) => {
        console.log('Starting a new stream with ' + stream_nodes[0]);
        // Starting the steem operations stream
        steemStream.api.streamOperations((err, operation) => {
            // Errors are mostly caused by RPC nodes crashing
            if(err) return reject(err);
            // Resteems are inside custom_json operations
            if(steem_accounts.resteems.length > 0 && operation[0] === 'custom_json') {
                const op = JSON.parse(operation[1].json);
                // Checking if it's a resteem and if it's from one of the specified accounts
                if(op[0] === 'reblog' && steem_accounts.resteems.includes(op[1].account)) {
                    processOperation(op[1].author, op[1].permlink, op[0]);
                }
            // Checking if it's a post (not a comment) made by one of the specified accounts
            } else if(operation[0] === 'comment' && steem_accounts.posts.includes(operation[1].author) && operation[1].parent_author === '') {
                processOperation(operation[1].author, operation[1].permlink, operation[0]);
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

/**
 * Tweets a message if the related URL hasn't been tweeted yet
 * @param {string} message The tweet content
 * @param {string} url The post's URL
 */
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
                            setTimeout(tweet, tweet_retry_timeout, message, url);
                        }
                    } else {
                        console.log('Successfully tweeted', message);
                        tweetsInterval = setInterval(() => {
                            if(tweetStack[0]) {
                                // Making sure that no tweet is sent while processing this one
                                clearInterval(tweetsInterval);
                                const [message, url] = tweetStack.shift();
                                tweet(message, url);
                            }
                        }, settings.tweet_frequency_minutes * 60 * 1000);
                    }
                });
            } else console.log('A tweet with the same link has already been sent.');
        })
        .catch(err => {
            console.error('Twitter Search API Error:', err.message);
            console.log('Retrying...');
            setTimeout(tweet, tweet_retry_timeout, message, url);
        });
}

/**
 * Checks if a link has already been tweeted in the last 7 days
 * This function is still a prototype and may resolve to false with some already tweeted links
 * @param {string} url The post's url
 * @returns {Promise} Unrejectable promise resolving to true if a URL has already been tweeted and false otherwise
 */
function isAlreadyTweeted(url) {
    // The Twitter Search API is a mess, can't handle the @ character
    const urlAllowedParts = url.split('@');
    return new Promise(resolve => {
        // Tweet-like post
        if(url === '') resolve(false);
        const query = { q: 'url:' + urlAllowedParts[urlAllowedParts.length - 1], count: 100, result_type: 'recent' };
        twitter.get('search/tweets', query, (err, data, response) => {
            if(err) resolve(false);
            else resolve(data.statuses.some(tweet => tweet.user.screen_name === twitter_handle));
        });
    });
}

/**
 * Gets the link associated to the post on its original app or on the default app
 * @param {string} app The app associated to the post
 * @param {string} author The post's author
 * @param {string} permlink The post's permlink
 * @param {string} url The post's url (from the blockchain)
 * @param {string[]} tags The post's tags
 * @param {string} body The post's body
 * @returns {string} Link associated to the post
 */
function getWebsite(app, author, permlink, url, tags, body) {
    if(!app || !settings.allowed_apps[app]) {
        // Special case for the Głodni Wiedzy app
        if(author == 'glodniwiedzy') app = author;
        // Special case for the Knacksteem app
        else if(tags[0] === 'knacksteem') app = tags[0];
        else return null;
    }
    if(settings.allowed_apps[app] === 1) app = settings.default_app;
    switch(app) {
        case 'bescouted':
            // Bescouted links don't follow the Steem apps logic, therefore the link has to be fetched from the body
            // If the user removed the website link, the post is treated as a steemit post
            return body.match(/\(?:https:\/\/www\.(bescouted\.com\/photo\/\d{8,}\/[\w-]+\/\d{8,})\/\)/)[0] || 'steemit.com' + url;
        case 'blockdeals':
            return 'blockdeals.org' + url;
        case 'blockpress':
            return 'blockpress.me/?p=steem' + url;
        case 'busy':
            return 'busy.org/@' + author + '/' + permlink;
        case 'coogger':
            return 'coogger.com/@' + author + '/' + permlink;
        case 'dlike':
            return 'dlike.io/post/' + author + '/' + permlink;
        case 'dlive':
            // Links for videos and livestreams don't have the same structure, the only way to check which one the post is is to check the post tags
            // DLive automatically transforms livestream links to video links when accessed once the livestream ended so the app doesn't have to check for that
            if(tags.includes('dlive-broadcast')) return 'dlive.io/livestream/' + author + '/' + permlink;
            if(tags.includes('dlive-video')) return 'dlive.io/video/' + author + '/' + permlink;
            // If the user changed the identifying tag, the post is treated as a steemit post
        case 'dmania':
            return 'dmania.lol/post/' + author + '/' + permlink;
        case 'dsound':
            return 'dsound.audio/#!/@' + author + '/' + permlink;
        case 'dtube':
            return 'd.tube/#!/v/' + author + '/' + permlink;
        case 'fundition':
            return 'fundition.io/#!/@' + author + '/' + permlink;
        case 'glodniwiedzy':
            return 'glodniwiedzy.pl/' + permlink;
        case 'hede':
            return 'hede.io' + url;
        case 'insteem':
            return 'www.insteem.com/stories/' + author + '/' + permlink;
        case 'knacksteem':
            return 'knacksteem.org/articles/' + author + '/' + permlink;
        case 'memeit.lol':
            return 'memeit.lol/@' + author + '/' + permlink;
        case 'mTasks':
            return 'steemmtask.herokuapp.com/@' + author + '/' + permlink;
        case 'parley':
            return 'parley.io/thread/' + author + '/' + permlink;
        case 'steemd':
            return 'steemd.com' + url;
        case 'steemdb':
            return 'steemdb.com' + url;
        case 'steemgig':
            return 'steemgigs.org/@' + author + '/' + permlink;
        case 'steemhunt':
            return 'steemhunt.com/@' + author + '/' + permlink;
        case 'steemkr':
            return 'steemkr.com' + url;
        case 'steempeak':
            return 'steempeak.com' + url;
        case 'steepshot':
            return 'alpha.steepshot.io/post/@' + author + '/' + permlink;
        case 'strimi':
            return 'strimi.pl' + url;
        case 'ulogs':
            return 'ulogs.org/@' + author + '/' + permlink;
        case 'uneeverso':
            return 'www.uneeverso.com' + url;
        case 'utopian':
            return 'utopian.io' + url;
        case 'vimm.tv':
            return 'www.vimm.tv/@' + author;
        case 'zappl':
            return 'zappl.com/' + url.split('/')[1] + '/' + author + '/' + permlink;
        // If the app specified in settings.default_app doesn't exist, doesn't support viewing posts, isn't yet supported or isn't correctly written, use Steemit for the link
        // Apps that get a steemit.com link: steemit, dbooks, chainbb, esteem, masdacs, steemauto, steempress, postpromoter, Steem Harry Games, vote-buyer, steemjs, piston-lib, undefined
        // The list of supported apps is manually updated. If an app is missing, please contact me through any of the means specified in the README file or send a new issue
        default:
            return 'steemit.com' + url;
    }
}

/**
 * Processes a reblog operation or a comment operation
 * @param {string} author The post's author
 * @param {string} permlink The post's permlink
 * @param {string} type The post's type (reblog or comment)
 */
function processOperation(author, permlink, type) {
    new Promise((resolve, reject) => {
        // Getting the content of the post
        steemRequest.api.getContent(author, permlink, (err, result) => {
            if(err) return reject(err);
            // If the operation is a comment operation, it must be a post creation, not a post update
            else if(type === 'reblog' || type === 'comment' /*&& result.last_update === result.created*/) {
                let metadata;
                try {
                    metadata = JSON.parse(result.json_metadata);
                    if(!metadata) throw new Error('The metadata is ', metadata);
                    if(typeof metadata !== 'object') throw new Error('The metadata is of type ' + typeof metadata);
                } catch(err) {
                    return reject(err);
                }
                let website, templateType;
                // Twitter-like posts
                if(settings.advanced_mode_steem_accounts.includes(author) && /^(?:\s*!\[[^\]]*]\([^)]*\))*\s*$/.test(result.body)) {
                    website = '';
                    templateType = 'tweet_like';
                // First parameter (app): checking for all the known ways of specifying an app, if none of them exists the app is set to undefined
                } else {
                    website = getWebsite(metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined, result.author, result.permlink, result.url, metadata.tags, result.body);
                    templateType = (type === 'reblog' ? 'resteem': 'post')
                }
                // If tweeting has been allowed for posts from this website
                if(website !== null) {
                    const tweetTemplate = template[templateType];
                    const values = {
                        author: author,
                        link: website === '' ? '' : '%' + '_'.repeat(LINK_LENGTH - 2) + '%',
                        tags: metadata.tags || result.category,
                        title: result.title
                    }
                    let tweetStructure = parser.parse(tweetTemplate, values);
                    while(tweetStructure.parsed.length > MAX_TWEET_LENGTH) {
                        tweetStructure = removeLeastImportant(tweetStructure);
                    }
                    tweetStructure.parsed = tweetStructure.parsed.replace(values.link, website);
                    tweetStack.push([tweetStructure.parsed, website]);
                }
            }
        });
    }).catch(err => {
        console.error('Error:', err.message, 'with', request_nodes[0]);
        // Putting the node element at the end of the array
        request_nodes.push(request_nodes.shift());
        steemRequest.api.setOptions({ url: request_nodes[0] });
        console.log('Retrying with', request_nodes[0]);
        processOperation(author, permlink, type);
    });
}

/**
 * Removes or modifies the least important element from a structure
 * @param {object} structure The structure of the part of a tweet
 * @returns {object} The passed structure with one modified element
 */
function removeLeastImportant(structure) {
    if(structure.children.length > 0) {
        const leastImportantChild = structure.children[structure.children.length - 1];
        const originalLeastImportantChildParsed = leastImportantChild.parsed;
        if(leastImportantChild.children.length > 0) {
            leastImportantChild = removeLeastImportant(leastImportantChild);
            structure.parsed = structure.parsed.replace(originalLeastImportantChildParsed, leastImportantChild.parsed);
        } else {
            switch(leastImportantChild.variable) {
                case 'tags':
                    // If set to true, removes tags by order of importance (last tag removed first)
                    if(settings.tags.remove_tags_by_order) leastImportantChild.parsed = leastImportantChild.parsed.replace(/ ?#[A-Za-z\d-]+$/, '');
                    // If set to true, removes tags by order of importance (first tag removed first)
                    else if(settings.tags.remove_tags_by_order_opposite) leastImportantChild.parsed = leastImportantChild.parsed.replace(/^#[A-Za-z\d-]+ ?/, '');
                    // If set to true, removes tags by length (smallest removed first)
                    else if(settings.tags.remove_tags_by_length) {
                        const tags = leastImportantChild.parsed.split(' ');
                        const smallestTag = tags.reduce((a, b) => a.length < b.length ? a : b);
                        leastImportantChild.parsed = tags.filter(tag => tag !== smallestTag).join(' ');
                    // If set to true, removes tags by length (longest removed first)
                    } else if(settings.tags.remove_tags_by_length_opposite) {
                        const tags = leastImportantChild.parsed.split(' ');
                        const longestTag = tags.reduce((a, b) => a.length > b.length ? a : b);
                        leastImportantChild.parsed = tags.filter(tag => tag !== longestTag).join(' ');
                    } else leastImportantChild.parsed = '';
                    break;
                case 'title':
                    leastImportantChild.parsed = leastImportantChild.parsed.replace(/.(.{3})$/, (match, lastChars) => {
                        if(lastChars === '...') return '...';
                        else return match[0] + '...';
                    });
                    if(leastImportantChild.parsed === '...') leastImportantChild.parsed = '';
                    break;
                default:
                    leastImportantChild.parsed = '';
                    break;
            }
            structure.parsed = structure.parsed.replace(originalLeastImportantChildParsed, leastImportantChild.parsed).replace(/ +/, ' ');
            if(leastImportantChild.parsed === '') {
                structure.raw = structure.raw.replace(leastImportantChild.raw, '').replace(/ +/, ' ');
                structure.children.pop();
            }
        }
    }
    return structure;
}
