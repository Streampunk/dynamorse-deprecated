/* Copyright 2016 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var redioactive = require('../../../util/Redioactive.js');
var util = require('util');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var fs = require('fs');
var Grain = require('../../../model/Grain.js');

const variation = 1; // Grain timing requests may vary +-1ms

function statusError(status, message) {
  var e = new Error(message);
  e.status = status;
  return e;
}

module.exports = function (RED) {
  function SpmHTTPOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    var node = this;
    var srcFlow = null;
    this.on('error', function (err) {
      node.warn(`Error transporting flow over HTTP '${config.path}': ${err}`)
    });
    var grainCache = [];
    var clientCache = {};
    config.path = (config.path.endsWith('/')) ? config.path.slice(-1) : config.path;
    this.each(function (x, next) {
      if (Grain.isGrain(x)) {
        grainCache.push(x);
        if (grainCache.length > config.cacheSize)
          grainCache = grainCache.slice(grainCache.length - config.cacheSize);
        next(); // TODO timeout
      } else {
        node.warn(`HTTP out received something that is not a grain.`);
        next();
      }
    });
    if (config.mode === 'pull') {
      var app = express();
      app.use(bodyParser.raw({ limit : config.payloadLimit || 6000000 }));
      app.get(config.path + "/:ts", function (req, res) {
        var threadNumber = req.headers['arachnid-threadnumber'];
        var totalConcurrent = req.headers['arachnid-totalconcurrent'];
        var clientID = req.headers['arachnid-clientid'];
        var g = null;
        var tsMatch = req.params.ts.match(/([0-9]+):([0-9]{9})/);
        if (tsMatch) {
          var secs = +tsMatch[1]|0;
          var nanos = +tsMatch[2]|0;
          var rangeCheck = secs * 1000 + nanos / 1000000|0;
          g = grainCache.find(function (y) {
            var grCheck = (y.ptpOrigin.readUIntBE(0, 6) * 1000) +
              y.ptpOrigin.readUInt32BE(6) / 1000000|0;
            return (rangeCheck >= grCheck - variation) &&
              (rangeCheck <= grCheck + variation);
          });
        } else {
          if (!clientID)
            return next(statusError(400, 'When using relative timings, a client ID header must be provided.'));
          var ts = (req.params.ts) ? +req.params.ts : NaN;
          if (isNaN(ts) || ts > 0 || ts <= -totalConcurrent)
            return next(statusError(400, `Timestamp must be a number between ${-totalConcurrent + 1} and 0.`));
          if (!clientCache[clientID]) {
            clientCache[clientID] = {
              created : Date.now(),
              items : grainCache.slice(-totalConcurrent);
            };
          }
          var items = clientCache[clientID].items;
          g = items[items.length - ts - 1];
        }
        res.setHeader('Arachnid-ThreadNumber', threadNumber);
        res.setHeader('Arachnid-TotalConcurrent', totalConcurrent);
        if (clientID)
          res.setHeader('Arachnid-ClientID', clientID);
        res.setHeader('Arachnid-PTPOrigin', Grain.prototype.formatTimestamp(g.ptpOrigin));
        res.setHeader('Arachnid-PTPSync', Grain.prototype.formatTimestamp(g.ptpSync));
        res.setHeader('Arachnid-FlowID', uuid.unparse(g.flow_id));
        res.setHeader('Arachnid-SourceID', uuid.unparse(g.source_id));
        if (g.timecode)
          res.setHeader('Arachnid-Timecode',
            Grain.prototype.formatTimecode(g.timecode));
        if (g.duration)
          res.setHeader('Arachnid-GrainDuration',
            Grain.prototype.formatDuration(g.duration));
        res.setHeader('Content-Type', 'video/raw'); // FIXME
        res.setHeader('Content-Length', g.buffers[0].length);
        res.setHeader('Arachnid-NextByThread', )
        res.send(g.buffers[0]);
      });

      app.use(function (err, req, res, next) {
        if (err.status) {
          res.status(err.status).json({
            code: err.status,
            error: (err.message) ? err.message : 'Internal server error. No message available.',
            debug: (err.stack) ? err.stack : 'No stack available.'
          });
        } else {
          res.status(500).json({
            code: 500,
            error: (err.message) ? err.message : 'Internal server error. No message available.',
            debug: (err.stack) ? err.stack : 'No stack available.'
          })
        }
      });

      app.use(function (req, res, next) {
        res.status(404).json({
            code : 404,
            error : `Could not find the requested resource '${req.path}'.`,
            debug : req.path
          });
      });
    } else {
      // TODO implement push mode
    }

    setInterval(function () {
      var toDelete = [];
      var now = Date.now();
      Object.keys(clientCache).forEach(function (k) {
        if (clientCache[k].created - now > 5000) toDelete.push(k);
      }
      toDelete.forEach(function (k) { delete clientCache[k]; });
    }, 1000);
  }
  util.inherits(SpmHTTPOut, redioactive.Spout);
  RED.nodes.registerType("spm-http-out", SpmHTTPOut);
}
