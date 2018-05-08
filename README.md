# Tweem (0.1.5)
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
**⚠⚠⚠** I recommand to wait at least one minute after the "Starting a new stream" message appears in the console before testing it if you don't want your post to get unnoticed by the bot. This is because "Starting a new stream" doesn't mean that the stream is operational yet but that's it's about to be.

## Configuration
Before starting the bot, it is recommanded to take a look at the config file and to modify its values to match your liking.<br>
Here are all the configuration possibilities:
* **request_nodes:** list of RPC nodes to be used by the app to get posts informations (those need to be full nodes)
* **settings:**
  * ***allowed_apps:*** lets you decide how posts from various apps will be linked (0: not tweeted, 1: tweeted with a link to the post on the *default_app*, 2: tweeted with a link to the post on the app it comes from)
  * ***default_app:*** default app to be used when an app is not yet supported or has been set to 1 in *allowed_apps*. The value has to correspond to one of the labels in the supported apps table below.
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
* **steem_accounts:** lists of Steem accounts to react to when they post (posts) and/or when they resteem (resteems) (default: ['ragepeanut'] and ['ragepeanut'])
* **stream_nodes:** list of RPC nodes to be used by the app to stream operations (those can be low memory nodes)
* **template:** template for the tweet (explained in 'Create your own template')
* **tweet_retry_timeout:** time in milliseconds to wait for before retrying to tweet if it failed (default: 10000)
* **twitter_handle:** the **Twitter** handle used by the bot, aka your **Twitter** handle (default: 'RagePeanut_')

## Create your own template
**Tweems** aims to be the most configurable sharing bot on the **Steem** blockchain, that's why you can change how your tweets will look by changing their template. Let's take a look at the default template to understand what's happening.
```
{{title::2}} %%by @{{author}}::1%% {{tags::3}}
```
Every part of the tweet (except the 'by' part) is defined by `{{DATA::IMPORTANCE}}`, `DATA` is the data indicator, it can be replaced by 'title' or 'tags'. You can't have the same data indicator twice in a template. `IMPORTANCE` is a number that specifies how important this part of the tweet is. If a message is too long to be twitted (more than 280 characters), the part of the tweet that has the lowest `IMPORTANCE` number will get changed to fit the maximum message length. The `%%by @{{author}}::1%%` may be the hardest part of this template to understand, it corresponds to the 'by' part of the tweet and will only be in the tweet when you resteem a post. It is defined by `%%TEXT{{author}}TEXT::IMPORTANCE%%`. `TEXT` is any piece of text you would like to see in the tweet, `{{author}}` is the author username (right now, 'author' is the only value you can put between these curly brackets) and `IMPORTANCE` has already been explained before. You can only put on 'by' part in your template. The link is not defined in the template, that's because it must always be at the end of the tweet for **Twitter** to handle it well. Here are a few examples along with their expected results to help you understand how the templating works.
* `{{title::2}} %%by @{{author}}::1%% {{tags::3}}`<br>
**Post:** `TITLE TAGS`<br>
**Resteem:** `TITLE by @AUTHOR TAGS`

* `%%I just resteemed ::1%%{{title::2}} {{tags::3}}`<br>
**Post:** `TITLE TAGS`<br>
**Resteem:** `I just resteemed TITLE TAGS`

* `{{title::2}} %%by {{author}} was amazing!::1%%`<br>
**Post:** `TITLE`<br>
**Resteem:** `TITLE by AUTHOR was amazing!`

* `Check this post out! {{tags::1}}`<br>
**Post:** `Check this post out! TAGS`<br>
**Resteem:** `Check this post out! TAGS`

## Supported apps
Website | Label | Official description | Posting | Viewing
-|-|-|:-:|:-:
**[BeScouted](https://www.bescouted.com/)** | bescouted | Photography community that rewards for creating quality content. | **✓** | ✓
**[BlockDeals](https://blockdeals.org/)** | blockdeals | A Community Platform for Bargain Hunters and Deal Spotters. | **✓** | ✓ 
**[Busy](https://busy.org/)** | busy | Ensuring compensation for the creators of value. | **✓** | **✓**
**[DLive](https://www.dlive.io/#/)** | dlive | The first decentralized live streaming and video platform for you to share original content, and earn feeless rewards directly from your viewers. | **✓** | ✓
**[DSound](https://dsound.audio/)** | dsound | Decentralized Sound Platform. | **✓** | ✓
**[DTube](https://d.tube/)** | dtube | The first crypto-decentralized video platform, built on top of the **STEEM** Blockchain and the **IPFS** peer-to-peer network. | **✓** | ✓
**[Fundition](https://fundition.io/)** | fundition | A next-generation, decentralized, peer-to-peer crowdfunding and collaboration platform. | **✓** | ✓
**[Hede](https://hede.io/)** | hede | Knowledge Sharing Dictionary. | **✓** | ✓
**[Insteem](https://www.insteem.com/)** | insteem | Decentralized News by Independent Journalists. | ✗ | **✓**
**[Memeit.LOL](https://memeit.lol/)** | memeit.lol | A creative platform you can use to create your own meme and post it on the Steem Blockchain. | **✓** | ✓
**[mTasks](https://steemmtask.herokuapp.com/)** | mTasks | A Fiverr like platform built on top of **STEEM** Blockchain. | **✓** | ✓
**[OnePlace](https://oneplace.media/)** | oneplace | Web-application based on Steem and Golos blockchains. | **✓** | **✓** 
**[Parley](https://www.parley.io/)** | parley | The place where conversations happen. | **✓** | ✓
**[Steemd](https://steemit.com)** | steemd | A blockchain explorer for the **STEEM** blockchain. | ✗ | **✓**
**[SteemDB](https://steemdb.com/)** | steemdb | Block explorer and database for the **STEEM** blockchain. | ✗ | **✓**
**[Steemhunt](https://steemhunt.com/)** | steemhunt | A Steem Fueled Product Hunt. | **✓** | ✓
**[Steemit](https://steemit.com/)** | steemit | A social media platform where everyone gets paid for creating and curating content. | **✓** | **✓**
**[SteemKR](https://steemkr.com/)** | steemkr | Korean version of **Steemit**. | **✓** | **✓**
**[SteemThink](http://steemthink.com/)** | steemthink | You Ask - We Answer - Share Knowledge. | **✓** | **✓**
**[Steepshot](https://steepshot.io/)** | steepshot | Platform that rewards people for sharing their lifestyle and visual experience. | **✓** | ✓
**[Utopian](https://utopian.io/)** | utopian | Rewarding Open Source Contributors. | **✓** | ✓
**[Zappl](https://zappl.com/)** | zappl | Decentralized censorship resistant micro blogging Social Media site that pays. | **✓** | ✓

If you are working on a website that you feel should be in this list, let me know by contact me through on of my social networks listed below ! I'll add it as soon as possible.

## Special thanks to
**Steemit** for [steem.js](https://github.com/steemit/steem-js)<br>
**Tolga Tezel** for [Twit](https://github.com/ttezel/twit)

## Social networks
**Steemit:** https://steemit.com/@ragepeanut <br>
**Busy:** https://busy.org/@ragepeanut <br>
**Twitter:** [https://twitter.com/RagePeanut_](https://twitter.com/RagePeanut_) <br>
**Steam:** http://steamcommunity.com/id/ragepeanut/

### Follow me on [Steemit](https://steemit.com/@ragepeanut) or [Busy](https://busy.org/@ragepeanut) to be informed on my new releases and projects.
