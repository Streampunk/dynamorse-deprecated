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
var uuid = require('uuid');

const variation = 1; // Grain timing requests may vary +-1ms
const nineZeros = '000000000';

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
    var contentType = '';
    var started = false;
    var app = null;;
    this.each(function (x, next) {
      if (started === false) {
        node.getNMOSFlow(x, function (err, f) {
          if (err) return node.warn("Failed to resolve NMOS flow.");
          if (f.tags.format[0] === 'video' && f.tags.encodingName[0] === 'raw') {
            contentType = `video/raw; sampling=${f.tags.sampling}; ` +
             `width=${f.tags.width}; height=${f.tags.height}; depth=${f.tags.depth}; ` +
             `colorimetry=${f.tags.colorimetry}; interlace=${f.tags.interlace}`;
          } else {
            contentType = `${f.tags.format}/${f.tags.encodingName}`;
            if (f.tags.clockRate) contentType += `; rate=${f.tags.clockRate}`;
            if (f.tags.channels) contentType += `; channels=${f.tags.channels}`;
          };
        });
        node.log(`content type ${contentType}`);
        if (app) {
          app.listen(config.port, function(err) {
            if (err) node.error(`Failed to start arachnid HTTP server: ${err}`);
            node.log(`Gonzales listening on port ${config.port}.`);
          });
        }
        started = true;
      };
      if (Grain.isGrain(x)) {
        grainCache.push(x);
        if (grainCache.length > config.cacheSize) {
          grainCache = grainCache.slice(grainCache.length - config.cacheSize);
        }
        setTimeout(next, config.timeout); // TODO timeout
      } else {
        node.warn(`HTTP out received something that is not a grain.`);
        next();
      }
    });

    if (config.mode === 'pull') {
      app = express();
      app.use(bodyParser.raw({ limit : config.payloadLimit || 6000000 }));
      app.get(config.path + "/:ts", function (req, res, next) {
        var threadNumber = req.headers['arachnid-threadnumber'];
        threadNumber = (isNaN(+threadNumber)) ? 0 : +threadNumber;
        var totalConcurrent = req.headers['arachnid-totalconcurrent'];
        totalConcurrent = (isNaN(+totalConcurrent)) ? 1 : +totalConcurrent;
        var clientID = req.headers['arachnid-clientid'];
        var g = null;
        var tsMatch = req.params.ts.match(/([0-9]+):([0-9]{9})/);
        if (tsMatch) {
          var secs = +tsMatch[1]|0;
          var nanos = +tsMatch[2]|0;
          var rangeCheck = secs * 1000 + nanos / 1000000|0;
          g = grainCache.find(function (y) { // FIXME busted maths?
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
              items : grainCache.slice(-totalConcurrent)
            };
          };
          var items = clientCache[clientID].items;
          g = items[items.length - ts - 1];
        };
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
        if (g.duration) {
          res.setHeader('Arachnid-GrainDuration',
            Grain.prototype.formatDuration(g.duration));
        } else {
          node.error('Arachnid requires a grain duration to function (for now).');
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', g.buffers[0].length);
        // FIXME this will not work without a grain duration
        var durArray = g.getDuration();
        var originArray = g.getOriginTimestamp();
        res.setHeader('DEBUG-TS', `${originArray} ${totalConcurrent * durArray[0] * 1000000000 / durArray[1]|0}`);
        originArray[1] = originArray[1] +
          totalConcurrent * durArray[0] * 1000000000 / durArray[1]|0;
        if (originArray[1] > 1000000000)
          originArray[0] = originArray[0] + originArray[1] / 1000000000|0;
        var nanos = originArray[1].toString();
        res.setHeader('Arachnid-NextByThread',
          `${originArray[0]}:${nineZeros.slice(nanos.length)}${nanos}`);
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
          });
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
      });
      toDelete.forEach(function (k) { delete clientCache[k]; });
    }, 1000);

    this.done(function () {
      node.log('Closing the app!');
      if (app) app.close();
    });
  }
  util.inherits(SpmHTTPOut, redioactive.Spout);
  RED.nodes.registerType("spm-http-out", SpmHTTPOut);
}
