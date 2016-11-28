# Jamesbot #

A simple web crawler with a Mongodb-based queue.

# Installation

```
$ npm install jamesbot
```

# How to use

## Automatic

```js
var Jamesbot = require('jamesbot');

var bot = Jamesbot({
    instanceName: 'MyJamesBot', // Optional
});

var url = 'http://nintendo.com';

bot.start(url, function(content, url) {
    // cheerio instance
    var text = content('html > body').text().toLowerCase();

    // Show the current url
    console.log(url);

    // Try to find the 'luigi' word in body text
    if (text.indexOf('luigi') !== -1) {
      console.log('found', url);
      process.exit(1)
    }
});
```

## Manual

```js
var Jamesbot = require('jamesbot');

// Init function
function init() {
    // Adding a simple url
    bot.queue.add(['http://nintendo.com']);

    // Adding a custom link obj
    var link = {
        url: 'http://nintendo.com/games',
        data: {
            isManual: true // Custom data to be used inside the callback
        }
    };

    bot.queue.add([link])
}

// Creating jamesbot instance
var bot = Jamesbot({
    instanceName: 'MyManualInstance', // Optional
    auto: false, // James will not add links on queue
    onStart: init
});

// Starting the bot
bot.start(function(content, url) {
    var data;

    // Show the current url
    console.log(url);

    // cheerio instance
    var text = content('html > body').text().toLowerCase();

    // Adding found links to queue
    bot.queue.add(this.foundLinks);

    // try to get the custom data
    data = this.currentLink.data;

    if (data && data.isManual) {
        console.log('Link added manually by init funciton');
    }

    // Try to find the 'luigi' word in body text
    if (text.indexOf('luigi') !== -1) {
        console.log('found', url);
        process.exit(1)
    }
});
```
