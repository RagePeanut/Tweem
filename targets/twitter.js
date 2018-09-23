const Twit = require('twit');
const request = require('request').defaults({ encoding: 'base64' });

const { settings, twitter_handle } = require('../config');

const twitter = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

// The current tweet length limit is at 280 characters
const MAX_LENGTH = 280;
// Twitter automatically replaces links by https://t.co/[A-Za-z\d]{10}
const LINK_LENGTH = 23;
// The current maximum amount of images linked to a tweet is 4
const MAX_IMAGE_COUNT = 4;

// Sending tweets with a specified delay between them
const stack = [];
let tweetsInterval = setInterval(processTweet, settings.post_frequency_minutes * 60 * 1000);

/**
 * Tweets if the related URL hasn't been tweeted yet
 * @param {string} params The tweet content
 * @param {string} [url] The post's URL
 */
function tweet(params, url) {
    // Checking if the link has already been included in a tweet from this account
    isAlreadyTweeted(url)
        .then(alreadyTweeted => {
            if(!alreadyTweeted) {
                twitter.post('statuses/update', params, err => {
                    if(err) {
                        // The tweet already exists
                        if(err.code === 187) console.error('Error: The tweet \'' + params.status + '\' already exists');
                        // Retry if it's another error
                        else {
                            console.error('Unknown error:', err.message);
                            console.log('Please notify @ragepeanut of the encountered error so it doesn\'t happen to other users')
                            console.log('Retrying...');
                            setTimeout(tweet, settings.post_retry_timeout, params, url);
                        }
                    } else {
                        console.log('Successfully tweeted', params.status);
                        tweetsInterval = setInterval(processTweet, settings.post_frequency_minutes * 60 * 1000);
                    }
                });
            } else console.log('A tweet with the same link has already been sent.');
        })
        .catch(err => {
            console.error('Twitter Search API Error:', err.message);
            console.log('Retrying...');
            setTimeout(tweet, settings.post_retry_timeout, params, url);
        });
}

/** Processes a tweet */
function processTweet() {
    if(stack[0]) {
        // Making sure that no tweet is sent while processing this one
        clearInterval(tweetsInterval);
        const [params, url] = stack.shift();
        if(url) tweet(params, url);
        else {
            Promise.all(params.media_ids.slice(0, MAX_IMAGE_COUNT).map(url => uploadImage(url)))
                   .then(media_ids => {
                       params.media_ids = media_ids.filter(id => id !== 'NOT_UPLOADED');
                       tweet(params);
                   });
        }
    }
}

/** 
 * Uploads an image on Twitter
 * @param {string} url The image's url
 * @returns {Promise} Unrejectable promise resolving to the uploaded media ID or to 'NOT_UPLOADED' 
 */
function uploadImage(url) {
    return new Promise(resolve => {
        request.get(url, (error, response, body) => {
            if(!error && response.statusCode === 200) {
                twitter.post('media/upload', { media_data: body }, (error, data) => {
                    if(error) resolve('NOT_UPLOADED');
                    else resolve(data.media_id_string);
                }); 
            } else resolve('NOT_UPLOADED');
        });
    });
}

/**
 * Checks if a link has already been tweeted in the last 7 days
 * This function is still a prototype and may resolve to false with some already tweeted links
 * @param {string} [url] The post's url
 * @returns Unrejectable promise resolving to the uploaded media id Unrejectable promise resolving to true if a URL has already been tweeted and false otherwise
 */
function isAlreadyTweeted(url) {
    return new Promise(resolve => {
        // Tweet-like posts
        if(!url) resolve(false);
        // The Twitter Search API is a mess, can't handle the @ character
        const urlAllowedParts = url.split('@');
        const query = { q: 'url:' + urlAllowedParts[urlAllowedParts.length - 1], count: 100, result_type: 'recent' };
        twitter.get('search/tweets', query, (err, data, response) => {
            if(err) resolve(false);
            else resolve(data.statuses.some(tweet => tweet.user.screen_name === twitter_handle));
        });
    });
}

/**
 * Adds a tweet to the stack of tweets
 * @param {boolean} isCrosspost 
 * @param {string} text
 * @param {string|string[]} other 
 */
function add(isCrosspost, text, other) {
    if(isCrosspost) stack.push([{ status: text, media_ids: other }]);
    else stack.push([{ status: text }, other]);
}

module.exports = {
    add,
    LINK_LENGTH,
    MAX_LENGTH
}