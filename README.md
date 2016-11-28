# Jamesbot #

A simple web crawler with a Mongodb-based queue.
# Installation

```
$ npm install jamesbot
```

# How to use

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
