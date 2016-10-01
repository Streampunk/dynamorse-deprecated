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
var naudiodon = require('naudiodon');
var Promise = require('promise');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function Speaker (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);

    this.srcFlow = null;
    this.bitsPerSample = 16;
    var audioOutput = null;
    var audioStarted = false;
    var node = this;

    this.each(function (x, next) {
      if (!Grain.isGrain(x)) {
        node.warn('Received non-Grain payload.');
        return next();
      }
      node.log(`Received ${util.inspect(x)}.`);
      var nextJob = (node.srcFlow) ?
        Promise.resolve(x) :
        (Promise.denodeify(node.getNMOSFlow, 1))(x)
        .then(function (f) {
          node.srcFlow = f;
          var audioOptions = {};
          node.bitsPerSample = +f.tags.encodingName[0].substring(1);
          switch (node.bitsPerSample) {
            case 8:
              audioOptions.sampleFormat = naudiodon.SampleFormat8Bit;
              break;
            case 16:
              audioOptions.sampleFormat = naudiodon.SampleFormat16Bit;
              break;
            case 24:
              audioOptions.sampleFormat = naudiodon.SampleFormat24Bit;
              break;
            case 32:
              audioOptions.sampleFormat = naudiodon.SampleFormat32Bit;
              break;
            default:
              throw new Error("Cannot determine sample format bits per sample.");
              break;
          }
          audioOptions.channelCount = +f.tags.channels[0];
          audioOptions.sampleRate = +f.tags.clockRate[0];
          if (config.deviceIndex >= 0) {
            audioOptions.deviceIndex = config.deviceIndex;
          }
          audioOutput = new naudiodon.AudioWriter(audioOptions);
          return new Promise(function (accept, reject) {
            var happyCallback = function (pa) {
              audioOutput.removeListener('error', reject);
              audioOutput.on('error', function (err) {
                node.error(`Error received from port audio library: ${err}`);
              });
              accept(x);
            };
            audioOutput.once('error', function (err) {
              audioOutput.removeListener('audio_ready', happyCallback);
              reject(err);
            });
            audioOutput.once('audio_ready', happyCallback);
          });
        });
      nextJob.then(function (g) {
        var capacity = audioOutput.write(swapBytes(g, node.bitsPerSample));
        if (audioStarted === false) {
          audioOutput.pa.start();
          audioStarted = true;
        }
        if (capacity === true) {
          next();
        }
        else {
          audioOutput.once('drain', next);
        }
      })
      .catch(function (err) {
        node.error(`Failed to play sound on device '${config.deviceIndex}': ${err}`);
      });
    }); // this.each
    this.errors(function (e, next) {
      node.warn(`Received unhandled error: ${e.message}.`);
      setImmediate(next);
    });
    this.done(function () {
      node.log('No more to hear here!');
      audioOutput.end();
    });
    this.close(function () {
      node.log('Closing the speaker - too loud!');
      audioOutput.end();
    });
  }
  util.inherits(Speaker, redioactive.Spout);
  RED.nodes.registerType("speaker", Speaker);

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
