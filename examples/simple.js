var Jamesbot = require('../lib/jamesbot');

var bot = Jamesbot({
    instanceName: 'MyJamesBot', // Optional
});

var url = 'http://nintendo.com';

bot.start(url, function(content, url) {
    // cheerio instance
    var text = content('html > body').text().toLowerCase();

    // Show the current url
    console.log(url);

    // Try to find the 'zelda' word within body text
    if (text.indexOf('luigi') !== -1) {
      console.log('found', url);
      process.exit(1)
    }
});
