/* Copyright 2016 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by appl cable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var redioactive = require('../../../util/Redioactive.js');
var util = require('util');
var Promise = require('promise');
var macadam;
try { macadam = require('macadam'); } catch(err) { console.log('SDI-Out: ' + err); }
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function SDIOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);

    this.srcFlow = null;
    var count = 0;
    var playback = null;
    var node = this;

    this.each(function (x, next) {
      if (!Grain.isGrain(x)) {
        node.warn('Received non-Grain payload.');
        return next();
      }
      var nextJob = (node.srcFlow) ?
        Promise.resolve(x) :
        (Promise.denodeify(node.getNMOSFlow, 1))(x)
        .then(function (f) {
          node.srcFlow = f;
          if (f.tags.format[0] !== 'video') {
            return node.preFlightError('Only video sources supported for SDI out.');
          }
          var bmMode = macadam.bmdModeHD1080i50;
          var bmFormat = macadam.bmdFormat10BitYUV;
          // switch (+f.tags.height[0]) {
          //   case 2160:
          //   case 1080:
          //     switch (x.getDuration()[0]) {
          //       case
          //     }
          //     break;
          //   case 720:
          //   case 576:
          //   case 486:
          //   default:
          //     node.preFlightError('Could not establish Blackmagic mode.');
          // }
          playback = new macadam.Playback(config.deviceIndex,
            bmMode, bmFormat);
          playback.on('error', function (e) {
            node.warn(`Received playback error from Blackmagic card: ${e}`);
            next();
          });
          return x;
        });
      nextJob.then(function (g) {
        if (count < +config.frameCache) {
          node.log(`Caching frame ${count}/${typeof config.frameCache}.`);
          playback.frame(g.buffers[0]);
          count++;
          if (count === +config.frameCache) {
            node.log('Starting playback.');
            playback.start();
          }
          next();
        } else {
          playback.once('played', function () {
            node.log(`Playing frame ${count}.`);
            playback.frame(g.buffers[0]);
            count++;
            next();
          });
        };
      })
      .catch(function (err) {
        node.error(`Failed to play video on device '${config.deviceIndex}': ${err}`);
      });
    });

    node.errors(function (e, next) {
      node.warn(`Received unhandled error: ${e.message}.`);
      setImmediate(next);
    });
    node.done(function () {
      node.log('No more to see here!');
      playback.stop();
    });
    node.close(function () {
      node.log('Closing the video - too bright!');
      playback.stop();
    });
    process.on('exit', function () {
      if (playback) playback.stop();
    });
    process.on('SIGINT', function () {
      if (playback) playback.stop();
    });
  }
  util.inherits(SDIOut, redioactive.Spout);
  RED.nodes.registerType("sdi-out", SDIOut);
}
