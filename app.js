const Twit = require('twit');
const steem = require('steem');

const twitter = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

const { nodes, settings, steem_accounts, tweet_retry_timeout } = require('./config');

let index = 0;

stream();

function stream() {
    steem.api.setOptions({ url: nodes[index] });
    return new Promise((resolve, reject) => {
        console.log('Starting a new stream with ' + nodes[index]);
        steem.api.streamOperations((err, operation) => {
            if(err) return reject(err);
            if(operation[0] === 'custom_json') {
                const op = JSON.parse(operation[1].json);
                if(op[0] === 'reblog' && steem_accounts.includes(op[1].account)) {
                    steem.api.getContent(op[1].author, op[1].permlink, (err, result) => {
                        if(err) console.log(err.message, 'encountered while getting the content of /@' + op[1].author + '/' + op[1].permlink);
                        else {
                            const metadata = JSON.parse(result.json_metadata);
                            let message = '';
                            // Title
                            if(settings.include_title) {
                                // Mentions
                                if(settings.remove_mentions) result.title = result.title.replace(/( )?@[a-zA-Z0-9._-]+( )?/g, (match, firstSpace, secondSpace) => { return firstSpace || secondSpace});
                                else if(settings.remove_mentions_at_char) result.title = result.title.replace(/@([a-zA-Z0-9._-]+)/g, '$1');
                                else if(settings.escape_starting_mention && result.title[0] === '@') result.title = '.' + result.title;
                                message += result.title + ' ';
                            }
                            // Tags
                            if(settings.include_tags) {
                                let tags = metadata.tags || [result.category];
                                if(settings.check_for_duplicate_tags) {
                                    const tmpTags = [];
                                    tags.forEach(tag => {
                                        if(!tmpTags.includes(tag)) tmpTags.push(tag);
                                    });
                                    tags = tmpTags;
                                }
                                if(settings.tag_limit) tags = tags.slice(0, settings.tag_limit);
                                tags.unshift('');
                                message += tags.reduce((accumulator, tag) => accumulator + '#' + tag + ' ');
                            }
                            message += getWebsite(metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined, result.author, result.permlink, result.url, metadata.tags, result.body, result.id)
                            console.log(message);
                            tweet(message);
                            //console.log(result.title + ' #' + ((metadata.tags && metadata.tags.join(' #')) || result.category) + ' ' + getWebsite(metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined, result.author, result.permlink, result.url, metadata.tags, result.body, result.id));
                        }
                    });
                }
            }
        });
    }).catch(err => {
        console.log('Stream error:', err.message, 'with', nodes[index]);
        index = ++index === nodes.length ? 0 : index;
        stream();
    });
}

function tweet(message) {
    twitter.post('statuses/update', { status: message }, (err, data, response) => {
        if(err) setTimeout(tweet, tweet_retry_timeout, message);
    });
}

function getWebsite(app, author, permlink, url, tags, body, id) {
    // If the app is steemit or its links are not allowed/supported, treats the post as a steemit post
    if(!settings.allowed_links[app]) return 'steemit.com' + url;
    switch(app) {
        case 'fundition':
            return 'fundition.io/#!/@' + author + '/' + permlink;
        case 'busy':
            return 'busy.org/@' + author + '/' + permlink;
        case 'utopian':
            return 'utopian.io/u/' + id;
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
        case 'bescouted':
            // If the user removed the website link, treats the post as a steemit post
            return body.match(/\(?:https:\/\/www\.(bescouted\.com\/photo\/\d{8,}\/[\w-]+\/\d{8,})\/\)/)[0] || 'steemit.com' + url;
        case 'steemkr':
            return 'steemkr.com' + url;
        case 'dlive':
            if(tags.includes('dlive-broadcast')) return 'dlive.io/livestream/' + author + '/' + permlink;
            if(tags.includes('dlive-video')) return 'dlive.io/video/' + author + '/' + permlink;
            // If the user changed the identifying tag, treats the post as a steemit post
        default: 
            // steemit, chainbb, esteem, masdacs, steemauto, steempress, Steem Harry Games, vote-buyer, steemjs, piston-lib, undefined and more
            return 'steemit.com' + url;
    }
}