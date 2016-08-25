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
  var count = 0;
  function SpmHTTPOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    var node = this
    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context to be updated.');
    var srcFlow = null;
    this.on('error', function (err) {
      node.warn(`Error transporting flow over HTTP '${config.path}': ${err}`)
    });
    var grainCache = [];
    var clientCache = {};
    config.path = (config.path.endsWith('/')) ? config.path.slice(0, -1) : config.path;
    var contentType = '';
    var started = false;
    var app = null; var server = null;
    var getNext = null;
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
          server = app.listen(config.port, function(err) {
            if (err) node.error(`Failed to start arachnid HTTP server: ${err}`);
            node.log(`Gonzales listening on port ${config.port}.`);
          });
        }
        started = true;
      };
      if (Grain.isGrain(x)) {
        grainCache.push({ grain : x, nextFn : next});
        getNext = next;
        if (grainCache.length > config.cacheSize) {
          grainCache = grainCache.slice(grainCache.length - config.cacheSize);
        }
        if (config.backpressure === false) setTimeout(next, config.timeout); // TODO accurate timeout
      } else {
        node.warn(`HTTP out received something that is not a grain.`);
        next();
      }
    });
    if (config.mode === 'pull') {
      app = express();
      // app.use(bodyParser.raw({ limit : config.payloadLimit || 6000000 }));
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
            var grCheck = (y.grain.ptpOrigin.readUIntBE(0, 6) * 1000) +
              y.grain.ptpOrigin.readUInt32BE(6) / 1000000|0;
            return (rangeCheck >= grCheck - variation) &&
              (rangeCheck <= grCheck + variation);
          });
        } else {
          if (!clientID)
            return next(statusError(400, 'When using relative timings, a client ID header must be provided.'));
          var ts = (req.params.ts) ? +req.params.ts : NaN;
          threadNumber = totalConcurrent + ts - 1;
          if (isNaN(ts) || ts > 0 || ts <= -totalConcurrent)
            return next(statusError(400, `Timestamp must be a number between ${-totalConcurrent + 1} and 0.`));
          if (!clientCache[clientID] ||
              Date.now() - clientCache[clientID].created > 5000) { // allow for backpressure restart
            clientCache[clientID] = {
              created : Date.now(),
              items : grainCache.slice(-totalConcurrent)
            };
          };
          if (config.backpressure === true && Object.keys(clientCache).length > 1) {
            delete clientCache[clientID];
            return next(statusError(400, `Only one client at a time is possible with back pressure enabled.`));
          }
          var items = clientCache[clientID].items;
          g = items[items.length + ts - 1].grain;
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
        var data = new Buffer(5184000); //g.buffers[0];
        res.setHeader('Content-Length', data.length);
        // FIXME this will not work without a grain duration
        var durArray = g.getDuration();
        var originArray = g.getOriginTimestamp();
  //      res.setHeader('DEBUG-TS', `${originArray} ${totalConcurrent * durArray[0] * 1000000000 / durArray[1]|0}`);
        originArray[1] = originArray[1] +
          totalConcurrent * durArray[0] * 1000000000 / durArray[1]|0;
        if (originArray[1] > 1000000000)
          originArray[0] = originArray[0] + originArray[1] / 1000000000|0;
        var nanos = originArray[1].toString();
        res.setHeader('Arachnid-NextByThread',
          `${originArray[0]}:${nineZeros.slice(nanos.length)}${nanos}`);
        var startSend = process.hrtime();
        var written = 0;
        var count = 0; var drains = 0;
        write();
        function write() {
          drains++;
          var ok = true;
          while (written < data.length && ok) {
            ok = res.write(data.slice(written, written + 8192));
            written += 8192; count++;
          }
          if (written < data.length) {
            res.once('drain', write);
          } else {
            res.end(function() {
              node.log(`Sending grain took ${(function (a) {
                return a[0]*1000 + a[1]/1000000; })(process.hrtime(startSend))}ms ` +
                `in ${count} writes chunked into ${drains} parts.`);
              if (getNext) getNext();
            });
          }
        }
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

    this.clearDown = null;
    if (config.backpressure === false && this.clearDown === null) {
      this.clearDown = setInterval(function () {
        var toDelete = [];
        var now = Date.now();
        Object.keys(clientCache).forEach(function (k) {
          if (now - clientCache[k].created > 5000) toDelete.push(k);
        });
        toDelete.forEach(function (k) {
          node.log(`Clearing clientID '${k}' from the client cache.`);
          delete clientCache[k];
        });
      }, 1000);
    };

    this.done(function () {
      node.log('Closing the app!');
      clearInterval(this.clearDown); this.clearDown = null;
      if (server) server.close();
    }.bind(this));
  }
  util.inherits(SpmHTTPOut, redioactive.Spout);
  RED.nodes.registerType("spm-http-out", SpmHTTPOut);
}
