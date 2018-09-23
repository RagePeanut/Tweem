const steemStream = require('steem');
const steemRequest = require('steem');

const parser = require('./utils/parser');
const targets = {
    twitter: require('./targets/twitter')
}

const { request_nodes, settings, social_networks, steem_accounts, stream_nodes, template } = require('./config');

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
            else if(type === 'reblog' || type === 'comment' && result.last_update === result.created) {
                let metadata;
                try {
                    metadata = JSON.parse(result.json_metadata);
                    if(!metadata) throw new Error('The metadata is ', metadata);
                    if(typeof metadata !== 'object') throw new Error('The metadata is of type ' + typeof metadata);
                } catch(err) {
                    return reject(err);
                }
                let templateType;
                // Tweet-like posts
                if(settings.advanced_mode_steem_accounts.includes(author) && /^(?:\s*!\[[^\]]*]\([^)]*\))*\s*$/.test(result.body)) templateType = 'tweet_like';
                else templateType = (type === 'reblog' ? 'resteem': 'post');
                // Checking for all the known ways of specifying an app, if none of them exists the app is set to undefined
                const app = metadata.community || (metadata.app && (metadata.app.name || metadata.app.split('/')[0])) || undefined;
                let website = getWebsite(app, result.author, result.permlink, result.url, metadata.tags, result.body);
                // If posting has been allowed for posts from this website
                if(website) {
                    for(let target in social_networks) {
                        if(social_networks[target]) {
                            const values = {
                                author: author,
                                link: website === '' ? '' : '%' + '_'.repeat(targets[target].LINK_LENGTH - 2) + '%',
                                tags: metadata.tags || [result.category],
                                title: result.title
                            }
                            let structure = parser.parse(template[templateType], values);
                            while(structure.parsed.length > targets[target].MAX_LENGTH) {
                                structure = parser.removeLeastImportant(structure);
                            }
                            structure.parsed = structure.parsed.replace(values.link, website);
                            targets[target].add(templateType === 'tweet_like', structure.parsed, templateType === 'tweet_like' ? metadata.image || [] : website);
                        }
                    }
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
 * Gets the link associated to the post on its original app or on the default app
 * @param {string} app The app associated to the post
 * @param {string} author The post's author
 * @param {string} permlink The post's permlink
 * @param {string} url The post's url (from the blockchain)
 * @param {string[]} tags The post's tags
 * @param {string} body The post's body
 * @returns {string|null} Link associated to the post
 */
function getWebsite(app, author, permlink, url, tags, body) {
    if(!app) {
        // Special case for the Głodni Wiedzy app
        if(author == 'glodniwiedzy') app = author;
        // Special case for the Knacksteem app
        else if(tags[0] === 'knacksteem') app = tags[0];
    }
    if(settings.allowed_apps[app] === 0) return null;
    else if(settings.allowed_apps[app] === 1) {
        const allowedDefaultApps = ['blockpress', 'busy', 'insteem', 'steemd', 'steemdb', 'steemit', 'steemkr', 'steempeak', 'strimi', 'ulogs', 'uneeverso'];
        app = settings.default_app;
        // If the app specified in settings.default_app doesn't exist, doesn't support viewing posts, isn't yet supported or isn't correctly written, use Steemit for the link
        if(!allowedDefaultApps.includes(app) && settings.allowed_apps[app] !== 2) app = 'steemit';
    }
    switch(app) {
        case 'bescouted':
            // Bescouted links don't follow the Steem apps logic, therefore the link has to be fetched from the body
            const link = body.match(/\(?:https:\/\/www\.(bescouted\.com\/photo\/\d{8,}\/[\w-]+\/\d{8,})\/\)/)[0];
            // If the user removed the website link, the post is linked to the default app
            if(link) return link;
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
        // Apps that get a steemit.com link: steemit, dbooks, chainbb, esteem, masdacs, steemauto, steempress, share2steem, postpromoter, Steem Harry Games, vote-buyer, steemjs, piston-lib, undefined
        // The list of supported apps is manually updated. If an app is missing, please contact me through any of the means specified in the README file or send a new issue
        default:
            return 'steemit.com' + url;
    }
}