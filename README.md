# Tweem (0.2.2)
Tweem is a bot that automatically shares all the resteems and/or recent posts of specified accounts to your favorite social networks, it can also crosspost your tweet-like posts.

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
You will come accross some **process.env.SOMETHING** fields in the **app.js** file. If you plan on deploying this bot on a safe environment (locally for example), you can replace them by your app's keys in between single quotes. You can find all the required keys on the **Keys and Access Tokens** page. However, if you plan on deploying it online you **MUST** protect those keys. The app uses environment variables to achieve that but you are free to use any other way as long as it's secure. I recommend using [Heroku](https://www.heroku.com/) if you want to deploy this bot easily and freely.

4. **Building the bot**
```
cd Tweem/
npm install
```
5. **Starting the bot**
```
npm start
```
**⚠⚠⚠** I recommend to wait at least one minute after the "Starting a new stream" message appears in the console before testing it if you don't want your post to get unnoticed by the bot. This is because "Starting a new stream" doesn't mean that the stream is operational yet but that's it's about to be.

## Configuration
Before starting the bot, it is recommended to take a look at the config file and to modify its values to match your liking.<br>
Here are all the configuration possibilities:
* **request_nodes:** list of RPC nodes to be used by the app to get posts informations (those need to be full nodes)
* **settings:**
  * ***advanced_mode_steem_accounts:*** list of accounts that get **Twitter**-like posts crossposted to **Twitter** instead of shared (default: ["ragepeanut"])
  * ***allowed_apps:*** lets you decide how posts from various apps will be linked (0: not posted, 1: posted with a link to the post on the *default_app*, 2: posted with a link to the post on the app it comes from)
  * ***default_app:*** default app to be used when an app is not yet supported or has been set to 1 in *allowed_apps*. The value has to correspond to one of the labels in the supported apps table below.
  * ***mentions:***
    * ***escape_starting_mention:*** escape a mention by adding a '.' in front of it if it is the first word of a tweet (default: true)
    * ***remove_mentions:*** remove mentions completely (default: false)
    * ***remove_mentions_at_char:*** remove the '@' character from mentions (default: false)
  * ***post_frequency_minutes:*** delay in minutes between posts sent to a social network (default: 0)
  * ***post_retry_timeout:*** time in milliseconds to wait for before retrying to post to a social network if it failed (default: 10000)
  * ***tags:***
    * ***check_for_duplicate:*** check for duplicate tags and remove them (default: true)
    * ***limit:*** limit of tags to be included in the post, represented by a number or false if no limit is wanted (default: false)
    * ***remove_tags_by_length:*** remove tags by length (smallest removed first) if the post is too long (default: false)
    * ***remove_tags_by_length_opposite:*** remove tags by length (longest removed first) if the post is too long (default: false)
    * ***remove_tags_by_order:*** remove tags by order of importance (last tag removed first) if the post is too long (default: true)
    * ***remove_tags_by_order_opposite:*** remove tags by their opposite order of importance (first tags removed first) if the post is too long (default: false)
* **social_networks:** the social networks to which **Tweem** should post (true = post, false = don't post, default: true)
* **steem_accounts:** lists of Steem accounts to react to when they post (posts) and/or when they resteem (resteems) (default: ["ragepeanut"] and ["ragepeanut"])
* **stream_nodes:** list of RPC nodes to be used by the app to stream operations (those can be low memory nodes)
* **template:** templates for the posts (explained in 'Create your own template')
  * ***post:*** template for posts related to posts
  * ***resteem:*** template for posts related to resteems
  * ***tweet_like:*** template for posts crossposted from tweet-like posts
* **twitter_handle:** the **Twitter** handle used by the bot, aka your **Twitter** handle (default: 'RagePeanut_')

## Create your own template
**Tweem** aims to be the most configurable sharing bot on the **Steem** blockchain, that's why you can change how your posts will look by changing their template for posts, resteems and tweet-like posts. Let's take a look at everything possible with this example template.
```
I just resteemed {title}::1 [by {author}]::3 {tags,capitalize}::2 {link}
```
This template can be separated in multiple parts to facilitate your comprehension. The parts are as follow, we will go through each of them: `I just resteemed`, `{title}`, `[by {author}]`, `{tags,capitalize}` and `{link}`. The first part, `I just resteemed`, is pretty straightforward. It simply is a *piece of text* that will not get altered whatsoever, which means the message produced will always start with `I just resteemed` no matter what. The second and last parts, `{title}` and `{link}` are *variables*. They will get replaced by their values. `{title}` will get replaced by the title of the post and `{link}` will get replaced by a link to the post. It is recommanded to keep the `{link}` *variable* at the end of templates since **Twitter** can behave weirdly when it isn't. `{tags,capitalize}` is also a *variable* but it contains one more thing: a *modifier*. *Modifiers* are used to ask **Tweem** to alter the value of a *variable*, they are added to *variables* by respecting this scheme (whitespaces are not allowed): `{variable,modifier}`. Three *modifiers* exist: `uppercase`, `lowercase` and `capitalize`. As for *variables*, you can see a short list of them below. The last part that hasn't been talked about yet is the `[by {author}]` part. It is used to specify that `by {author}` can be removed if there are too much characters for the message. In order to determine the order of removal of text parts and even if you only have one removable part, you have to use the `::importance` syntax after removable parts where 1 is the most important. As you can see in the template, `[{variable}]::importance` (removable *variables*) can be simply written `{variable}::importance`. Taking this template as an example, `[by {author}]` will get removed first, followed by `{tags,capitalize}` and then `{title}` if there are still too many characters.

Variable | Description | Removal
-|-|-
author | The post's author | Instant
link | The post's link | Instant
tags | The post's tags | Tag by tag
title | The post's title | Ellipsis

## Supported apps
Website | Label | Official description | Posting | Viewing
-|-|-|:-:|:-:
**[BeScouted](https://www.bescouted.com/)** | bescouted | Photography community that rewards for creating quality content. | **✓** | ✓
**[BlockDeals](https://blockdeals.org/)** | blockdeals | A Community Platform for Bargain Hunters and Deal Spotters. | **✓** | ✓ 
**[BlockPress](https://blockpress.me/)** | blockpress | Blockchain based content management system. | ✗ | **✓**
**[Busy](https://busy.org/)** | busy | Ensuring compensation for the creators of value. | **✓** | **✓**
**[Coogger](http://www.coogger.com/)** | coogger | An information sharing network that works with multiple applications. | **✓** | ✓
**[dlike](https://dlike.io/)** | dlike | Share What You Like. | **✓** | ✓
**[DLive](https://www.dlive.io/#/)** | dlive | The first decentralized live streaming and video platform for you to share original content, and earn feeless rewards directly from your viewers. | **✓** | ✓
**[dMania](https://dmania.lol/)** | dmania | Make money with memes, funny pictures and videos. | **✓** | ✓
**[DSound](https://dsound.audio/)** | dsound | Decentralized Sound Platform. | **✓** | ✓
**[DTube](https://d.tube/)** | dtube | The first crypto-decentralized video platform, built on top of the **STEEM** Blockchain and the **IPFS** peer-to-peer network. | **✓** | ✓
**[eSteem](https://esteem.app/) | esteem | Blog, vote, share pictures and get paid. | **✓** | **✓**
**[Fundition](https://fundition.io/)** | fundition | A next-generation, decentralized, peer-to-peer crowdfunding and collaboration platform. | **✓** | ✓
**[Głodni Wiedzy](https://glodniwiedzy.pl/)** | glodniwiedzy | Dedicated Polish Steem user interface for displaying content of selected users. | ✗ | ✓
**[Hede](https://hede.io/)** | hede | Knowledge Sharing Dictionary. | **✓** | ✓
**[Insteem](https://www.insteem.com/)** | insteem | Decentralized News by Independent Journalists. | ✗ | **✓**
**[Knacksteem](https://knacksteem.org/)** | knacksteem | Rewarding Talent. | **✓** | ✓
**[Memeit.LOL](https://memeit.lol/)** | memeit.lol | A creative platform you can use to create your own meme and post it on the Steem Blockchain. | **✓** | ✓
**[mTasks](https://steemmtask.herokuapp.com/)** | mTasks | A Fiverr like platform built on top of **STEEM** Blockchain. | **✓** | ✓
**[Parley](https://www.parley.io/)** | parley | The place where conversations happen. | **✓** | ✓
**[Partiko](https://partiko.app/)** | partiko | Fast and beautiful Steem on the go. | **✓** | **✓**
**[Share2Steem](https://share2steem.com/) | share2steem | Cross-post your public social publications to a Steemit account. | **✓** | ✗
**[Steemd](https://steemd.com)** | steemd | A blockchain explorer for the **STEEM** blockchain. | ✗ | **✓**
**[SteemDB](https://steemdb.com/)** | steemdb | Block explorer and database for the **STEEM** blockchain. | ✗ | **✓**
**[SteemGigs](https://steemgigs.org/)** | steemgig | A Revolutionary Decentralized Freelance Marketplace With Its Own Knowledge-Bank. |**✓** | ✓
**[Steemhunt](https://steemhunt.com/)** | steemhunt | A Steem Fueled Product Hunt. | **✓** | ✓
**[Steemit](https://steemit.com/)** | steemit | A social media platform where everyone gets paid for creating and curating content. | **✓** | **✓**
**[SteemKR](https://steemkr.com/)** | steemkr | Korean version of **Steemit**. | **✓** | **✓**
**[SteemPeak](https://steempeak.com/)** | steempeak | A new way to experience the Steem platform. | **✓** | **✓**
**[Steepshot](https://steepshot.io/)** | steepshot | Platform that rewards people for sharing their lifestyle and visual experience. | **✓** | ✓
**[Strimi](https://strimi.pl/)** | strimi | An interface for the **STEEM** blockchain that acts like **Reddit**. | **✓** | **✓**
**[Ulogs](https://ulogs.org/)** | ulogs | "True celebrity-hood" once and for all, for "everyone". | **✓** | **✓**
**[Uneeverso](https://www.uneeverso.com/)** | uneeverso | Gestión de automatización **STEEM**. | ✗ | **✓**
**[Utopian](https://utopian.io/)** | utopian | Rewarding Open Source Contributors. | **✓** | ✓
**[Vimm.TV](https://www.vimm.tv/)** | vimm.tv | Live Streaming Made Easy - Monetization Simplified | **✓** | ✓
**[Zappl](https://zappl.com/)** | zappl | Decentralized censorship resistant micro blogging Social Media site that pays. | **✓** | ✓

If you are working on a website that you feel should be in this list, let me know by contacting me through one of the social networks listed below ! I'll add it as soon as possible.

## Special thanks to
**Steemit** for [steem.js](https://github.com/steemit/steem-js)<br>
**Tolga Tezel** for [Twit](https://github.com/ttezel/twit)

## Social networks
**Steemit:** https://steemit.com/@ragepeanut <br>
**Busy:** https://busy.org/@ragepeanut <br>
**Twitter:** [https://twitter.com/RagePeanut_](https://twitter.com/RagePeanut_) <br>
**Steam:** http://steamcommunity.com/id/ragepeanut/

### Follow me on [Steemit](https://steemit.com/@ragepeanut) or [Busy](https://busy.org/@ragepeanut) to be informed on my new releases and projects.
