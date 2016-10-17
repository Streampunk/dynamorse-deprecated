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
var fs = require('fs');
var path = require('path');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function RawFileOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    console.log(util.inspect(config));
    fs.access(path.dirname(config.file), fs.W_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    if (config.headers) {
      fs.access(path.dirname(config.headers), fs.W_OK, function (e) {
        if (e) {
          return this.preFlightError(e);
        }
      }.bind(this));
    }
    this.log(config.file + " / " + config.headers);
    this.essenceStream = fs.createWriteStream(config.file);
    this.essenceStream.on('error', function (err) {
      this.error(`Failed to write to essence file '${config.file}': ${err}`);
    }.bind(this));
    this.headerStream = (config.headers) ?
      fs.createWriteStream(config.headers, { defaultEncoding: 'utf8' }) : null;
    if (this.headerStream) {
      this.headerStream.on('error', function (err) {
        this.error(`Failed to write to headers file '${config.headers}': ${err}`)
      }.bind(this));
      this.headerStream.write('[\n');
    }
    this.started = false;
    this.each(function (x, next) {
      if (!Grain.isGrain(x)) {
        this.warn('Received non-Grain payload.');
        return next();
      }
      this.log(`Received ${util.inspect(x)}.`);
      var preWriteTime = Date.now();
      this.essenceStream.write(x.buffers[0], function () {
        if (config.timeout === 0) setImmediate(next);
        else setTimeout(next, config.timeout - (Date.now() - preWriteTime));
      });
      if (this.headerStream) {
        if (this.started === false) {
          var contentType = 'application/octet-stream';
          this.getNMOSFlow(x, function (err, f) {
            if (err) {
              this.warn("Failed to resolve NMOS flow.");
            } else {
              var encodingName = f.tags.encodingName[0];
              if ((f.tags.packing[0]).toLowerCase() === 'v210') {
                encodingName = 'x-v210';
              }
              if (f.tags.format[0] === 'video' &&
                  (encodingName === 'raw' || encodingName === 'x-v210')) {
                contentType = `video/${encodingName}; sampling=${f.tags.sampling[0]}; ` +
                  `width=${f.tags.width[0]}; height=${f.tags.height[0]}; depth=${f.tags.depth[0]}; ` +
                  `colorimetry=${f.tags.colorimetry[0]}; interlace=0`; //${f.tags.interlace[0]}`;
              } else {
                contentType = `${f.tags.format}/${f.tags.encodingName}`;
                if (f.tags.clockRate) contentType += `; rate=${f.tags.clockRate[0]}`;
                if (f.tags.channels) contentType += `; channels=${f.tags.channels[0]}`;
              }
            }
            var gjson = x.toJSON();
            gjson.contentType = contentType;
            this.headerStream.write(JSON.stringify(gjson, null, 2));
            this.started = true;
          }.bind(this))
        } else {
          this.headerStream.write(',\n' + JSON.stringify(x, null, 2));
        }
      }
    }.bind(this));
    this.errors(function (e, next) {
      this.warn(`Received unhandled error: ${e.message}.`);
      if (config.timeout === 0) setImmediate(next);
      else setTimeout(next, config.timeout);
    }.bind(this));
    this.done(function () {
      this.log('Thank goodness that is over!');
      this.essenceStream.end();
      if (this.headerStream) {
        this.headerStream.end(']');
      }
    }.bind(this));
    process.on('SIGINT', function() {
      this.essenceStream.end();
      if (this.headerStream) {
        this.headerStream.end(']');
      }
    });
  }
  util.inherits(RawFileOut, redioactive.Spout);
  RED.nodes.registerType("raw-file-out", RawFileOut);
}
