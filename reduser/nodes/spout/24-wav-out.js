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
  function WAVOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);

    this.srcFlow = null;
    this.bitsPerSample = 16;

    fs.access(path.dirname(config.file), fs.W_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    this.wavStream = fs.createWriteStream(config.file);
    var initState = true;
    this.wavStream.on('error', function (err) {
      this.error(`Failed to write to essence WAV file '${config.file}': ${err}`);
    }.bind(this));
    this.each(function (x, next) {
      if (!Grain.isGrain(x)) {
        this.warn('Received non-Grain payload.');
        return next();
      }
      this.log(`Received ${util.inspect(x)}.`);
      if (!this.srcFlow) {
        this.getNMOSFlow(x, function (err, f) {
          if (err) return push("Failed to resolve NMOS flow.");
          this.srcFlow = f;

          var h = new Buffer(44);
          h.writeUInt32BE(0x52494646, 0); // RIFF
          h.writeUInt32LE(0xffffffff, 4); // Dummy length to be replaced
          h.writeUInt32BE(0x57415645, 8); // WAVE
          h.writeUInt32BE(0x666d7420, 12); // fmt
          h.writeUInt32LE(16, 16); // Subchunk size
          h.writeUInt16LE(1, 20); // PCM Format
          var channels = +f.tags.channels[0];
          h.writeUInt16LE(channels, 22); // No of channels
          var sampleRate = +f.tags.clockRate[0];
          h.writeUInt32LE(sampleRate, 24); // sample rate
          this.bitsPerSample = +f.tags.encodingName[0].substring(1);
          h.writeUInt32LE(Math.ceil(sampleRate * channels * (this.bitsPerSample / 8)), 28); // byte rate
          h.writeUInt16LE(Math.ceil(channels * (this.bitsPerSample / 8)), 32); // block align
          h.writeUInt16LE(this.bitsPerSample, 34); // Bits per sampls
          h.writeUInt32BE(0x64617461, 36); // data
          h.writeUInt32LE(0xffffffff, 40); // sub-chunk size ... to be fixed
          this.wavStream.write(h, function () {
            var preWriteTime = Date.now();
            this.wavStream.write(swapBytes(x, this.bitsPerSample), function () {
              if (config.timeout === 0) setImmediate(next);
              else setTimeout(next, config.timeout - (Date.now() - preWriteTime));
            });
          }.bind(this));
        }.bind(this));
      } else {
        var preWriteTime = Date.now();
        this.wavStream.write(swapBytes(x, this.bitsPerSample), function () {
          if (config.timeout === 0) setImmediate(next);
          else setTimeout(next, config.timeout - (Date.now() - preWriteTime));
        });
      }
    }.bind(this));
    this.errors(function (e, next) {
      this.warn(`Received unhandled error: ${e.message}.`);
      if (config.timeout === 0) setImmediate(next);
      else setTimeout(next, config.timeout);
    }.bind(this));
    this.done(function () {
      this.log('Let\'s wave goodbye!');
      this.wavStream.end();
    }.bind(this));
  }
  util.inherits(WAVOut, redioactive.Spout);
  RED.nodes.registerType("wav-out", WAVOut);

  function swapBytes(x, bitsPerSample) {
    x.buffers.forEach(function (x) {
      switch (bitsPerSample) {
        case 24:
          var tmp = 0|0;
          for ( var y = 0|0 ; y < x.length ; y += 3|0 ) {
            tmp = x[y];
            x[y] = x[y + 2];
            x[y + 2] = tmp;
          }
          break;
        case 16:
          var tmp = 0|0;
          for ( var y = 0|0 ; y < x.length ; y += 2|0 ) {
            tmp = x[y];
            x[y] = x[y + 1];
            x[y + 1] = tmp;
          }
          break;
        default: // No swap
          break;
      }
    });
    return x.buffers[0];
  }

}
