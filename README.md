# Tweem (0.2.1)
Tweem is a bot that automatically tweets all the resteems and/or recent posts of specified accounts.

## Deploy
**Required:** [Git](https://git-scm.com/), [NPM](https://www.npmjs.com/), [Node.js](https://nodejs.org/), a [Twitter](https://twitter.com/) account that will be used by the bot.<br>
If you wish to deploy your own version of this bot, follow these steps carefully.
1. **Cloning**
```
git clone https://github.com/RagePeanut/Tweem.git
```
2. **Setting up an app for your Twitter account**<br>
Log into your account on Twitter then visit [this page](https://apps.twitter.com/) and click on **Create New App**. Follow the steps until your bot is set up. Go on your bot's app page (not its public Twitter page, the one from your apps panel), click on **Permissions** then make sure **Read and Write** is selected under the **Access** title and click on the **Update Settings** button. Now click on **Keys and Access Tokens**, scroll down to the **Token Actions** subtitle and click on the **Generate My Access Token and Token Secret** button.

3. **Set your own keys**<br>
You will come accross some **process.env.SOMETHING** fields in the **app.js** file. If you plan on deploying this bot **ONLY** locally, you can replace them by your app's keys. You can find all the required keys on the **Keys and Access Tokens** page. However, if you plan on deploying it online you **MUST** protect those keys. The app uses environment variables to achieve that but you are free to use any other way as long as it's secure. I recommand using [Heroku](https://www.heroku.com/) if you want to deploy this bot easily and freely.

4. **Building the bot**
```
cd Tweem/
npm install
```
5. **Starting the bot**
```
npm start
```

## Configuration
Before starting the bot, it is recommanded to take a look at the config file and to modify its values to match your liking.<br>
Here are all the configuration possibilities:
* **nodes:** list of RPC nodes to be used by the app (those need to be full nodes, not low memory ones)
* **settings:**
  * ***allowed_links:*** replace default 'steemit.com' links by the link from the posts' apps (default: true)
  * ***include_tags:*** include tags in tweets (default: true)
  * ***include_title:*** include title in tweets (default: true)
  * ***mentions:***
    * ***escape_starting_mention:*** escape a mention by adding a '.' in front of it if it is the first word of a tweet (default: true)
    * ***remove_mentions:*** remove mentions completely (default: false)
    * ***remove_mentions_at_char:*** remove the '@' character from mentions (default: false)
  * ***tags:***
    * ***check_for_duplicate:*** check for duplicate tags and remove them (default: true)
    * ***limit:*** limit of tags to be included in the tweet, represented by a number or false if no limit is wanted (default: false)
    * ***remove_tags_by_length:*** remove tags by length (smallest removed first) if the tweet is too long (default: false)
    * ***remove_tags_by_length_opposite:*** remove tags by length (longest removed first) if the tweet is too long (default: false)
    * ***remove_tags_by_order:*** remove tags by order of importance (last tag removed first) if the tweet is too long (default: true)
    * ***remove_tags_by_order_opposite:*** remove tags by their opposite order of importance (first tags removed first) if the tweet is too long (default: false)
  * ***tweet_posts:*** tweet posts from the specified accounts (default: true)
  * ***tweet_resteems:*** tweet resteems from the specified accounts (default: true)
* **steem_accounts:** list of Steem accounts to watch (default: ['ragepeanut'])
* **tweet_retry_timeout:** time in milliseconds to wait for before retrying to tweet if it failed (default: 10000)

## Special thanks to
**Steemit** for [steem.js](https://github.com/steemit/steem-js)<br>
**Tolga Tezel** for [Twit](https://github.com/ttezel/twit)

## Social networks
**Steemit:** https://steemit.com/@ragepeanut <br>
**Busy:** https://busy.org/@ragepeanut <br>
**Twitter:** https://twitter.com/RagePeanut_ <br>
**Steam:** http://steamcommunity.com/id/ragepeanut/

### Follow me on [Steemit](https://steemit.com/@ragepeanut) or [Busy](https://busy.org/@ragepeanut) to be informed on my new releases and projects.
