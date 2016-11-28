'use strict';

var request = require('request');
var cheerio = require('cheerio');
var _ = require('lodash');
var URL = require('url-parse');
var normalizeUrl = require('normalize-url');
var MongoClient = require('mongodb').MongoClient;

function Module(options) {
    var _numPagesVisited = 0;
    var _dbInstance;
    var _dbQueueCollection;
    var _loopInterval;
    var _options;

    var defaultOptions = {
        mongodbUrl: 'mongodb://localhost:27017/jamesbot',
        auto: true,
        instanceName: '',
        method: 'GET',
        removeVisitedFromQueue: false,
        maxPagesToVisit: 0,
        requestsPerSecound: 5,
        referer: false,
        retries: 3,
        timeout: 10000,
        allowedDomains: [],
        dbCollectionName: 'queue',
        allowDuplicates: false,
    };

    _options = _.extend(defaultOptions, options);

    function _doRequest(link, cb) {
        _numPagesVisited++;
        var config;

        // If link obj has custom request configuration
        if (link.rq) {
            if (!link.rq.method) {
                throw 'Method is required.';
            }
            // Set custom configuration
            config = link.rq;
            config.uri = link.u;
        } else {
            config = {
                uri: link.u,
                method: _options.method,
                timeout: _options.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.24 (KHTML, like Gecko) Ubuntu/10.04 Chromium/11.0.696.0 Chrome/11.0.696.0 Safari/534.24.'
                }
            };
        }

        request(config, function(error, response, body) {
            if (error) {
                // If timeout, try again
                if (error.code === 'ETIMEDOUT') {
                    _setLinkAsUnvisited(link);
                }
                return
            }

            // Check status code (200 is HTTP OK)
            if (response.statusCode !== 200) {
                console.log('status error', response.statusCode);
                return;
            }

            // Parse the document body
            var $ = cheerio.load(body);
            var links = _getContentLinks($, link.u);

            // If auto is true, add found links to queue
            if (_options.auto) {
                //  Push Links to queue
                _addToQueue(links);
            }

            // Remove from queue
            if (_options.removeVisitedFromQueue) {
                _removeFromQueue(link)
            }

            // Call callback function
            (cb && cb.call && cb.call({
                $: cheerio,
                response: response,
                body: body,
                foundLinks: links,
                currentLink: {
                    url: link.u,
                    request: link.rq,
                    data: link.dt,
                    id: link._id
                }
            }, $, link.u))
        });

    }

    function _getContentLinks($, currentLink) {
        var foundLinks = $('a');
        var links = [];

        foundLinks.each(function() {
            try {
                var link = $(this).attr('href');

                if (!link) {
                    return;
                }

                links.push(_getCorrectURL(link, currentLink));
            } catch (e) {
                console.log(e);
            }
        });

        return links;
    }

    function _getCorrectURL(link, currentLink) {
        var url;
        var urlParsed;
        var baseUrl;

        if (!link || !currentLink) {
            return;
        }

        urlParsed = new URL(currentLink);
        baseUrl = urlParsed.protocol + '//' + urlParsed.hostname;

        baseUrl = normalizeUrl(baseUrl, {
            removeTrailingSlash: true,
            stripWWW: false
        });

        // Remove first slash
        link = link[0] === '/' ? link.substr(1) : link;

        // If is an internal link (with no http|https|www.) append the domain as prefix
        var match = link.match(/(?:https?:\/\/)?(?:www\.)?/);
        url = match && match[0].length > 0 ?
            link :
            baseUrl + '/' + link;

        return normalizeUrl(url, {
            removeTrailingSlash: true,
            stripFragment: true,
            stripWWW: false
        });
    }


    function _removeFromQueue(link) {
        _dbQueueCollection.remove({
            _id: link._id
        }, function(err, data) {
            if (err) {
                console.log(err);
                return
            }
        });
    }

    function _setLinkAsUnvisited(link) {
        // Set as unvisited
        _dbQueueCollection.update({
            _id: link._id
        }, {
            $set: {
                v: 0,
                r: link.r + 1
            }
        });
    }

    function _emptyQueue() {
        _dbQueueCollection.remove({
            i: _options.instanceName
        }, function (err, data) {
          if (err) {
            console.log(err);
          }
        });
    }

    function _queueCollectionInsert(link) {
        var objLink;

        // If is an URL string, create an object
        if (!link.url && !link.u) {
            objLink = {
                u: link,
                v: 0,
                d: Date.now(),
                r: 0,
                i: _options.instanceName
            };
        } else {
            objLink = {
                u: link.url || link.u,
                v: 0,
                d: Date.now(),
                r: 0,
                i: _options.instanceName,
                rq: link.request,
                dt: link.data
            };
        }

        if (_options.allowDuplicates) {
            _dbQueueCollection.insert(objLink, function(err, data) {
                if (err) {
                    console.log(err);
                }
            });
        } else {
            _dbQueueCollection.findAndModify({
                    u: objLink.u,
                    i: _options.instanceName
                }, [], {
                    $setOnInsert: objLink
                }, {
                    new: true,
                    upsert: true
                },
                function(err, doc) {
                    if (err) {
                        console.log(err);
                    }
                }
            );
        }
    }

    function _addToQueue(links) {
        links.forEach(function(link) {
            try {
                if (_options.allowedDomains.length > 0) {
                    var url = link.url || link.u || link;
                    var domain = new URL(url).hostname;
                    if (_options.allowedDomains.indexOf(domain) !== -1) {
                        _queueCollectionInsert(link);
                    }
                } else {
                    _queueCollectionInsert(link);
                }
            } catch (e) {
                console.log(e);
            }
        });
    }

    function _loop(cb) {
        _loopInterval = setInterval(function() {
            _dbQueueCollection.findOne({
                v: 0,
                i: _options.instanceName
            }, function(err, data) {
                if (err) {
                    return;
                }
                if (!data) {
                    return;
                }

                // Set as visited
                _dbQueueCollection.update({
                    _id: data._id
                }, {
                    $set: {
                        v: 1
                    }
                });

                if (data.r <= _options.retries && (_options.maxPagesToVisit === 0 || _numPagesVisited <= _options.maxPagesToVisit)) {
                    _doRequest(data, cb);
                }
            });
        }, 1000 / _options.requestsPerSecound);
    }

    function _stop() {
        clearInterval(_loopInterval);
    }

    function _start(url, cb) {
        cb = url && url.call ? url : cb;

        MongoClient.connect(_options.mongodbUrl, function(err, db) {
            if (err) {
                throw err;
            }

            _dbInstance = db;
            _dbQueueCollection = _dbInstance.collection(_options.dbCollectionName);

            try {
                _dbQueueCollection.createIndex({
                    u: 1
                }, {
                    unique: false
                });

                if (url) {
                    _addToQueue([url]);
                }
            } catch (e) {
                console.log(e);

            } finally {
                _loop(cb);
                (_options.onStart && _options.onStart.call && _options.onStart())
            }
        });
    }


    // Return the API
    return {
        start: _start,
        stop: _stop,
        queue: {
            add: _addToQueue,
            remove: _removeFromQueue,
            empty: _emptyQueue
        },
        link: {
            normalize: _getCorrectURL
        }
    }
}

module.exports = Module;
