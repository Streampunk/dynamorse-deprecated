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

var Grain = require('../model/Grain.js');
var codecadon = require('../../codecadon');
var grainProcessor = require('./grainProcessor.js');
var H = require('highland');

module.exports = function(srcTags) {
  var concater = new codecadon.Concater(function() {
    console.log('Concater exiting');
  });

  var dstSampleSize = calculateSampleSize(srcTags);
  var isVideo = srcTags.format[0] === 'video';

  var grainMuncher = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      console.log('Concater: Requesting Quit.');
      concater.quit(function() {
        push(null, H.nil);
      });
    } else {
      if (Grain.isGrain(x)) {
        console.log(JSON.stringify(x));
        var dstBuf = isVideo ?
          new Buffer(dstSampleSize) :
          new Buffer(x.getDuration()[0] * dstSampleSize);
        console.log(dstBuf.length);
        var numQueued = concater.concat(x.buffers, dstBuf, function(err, result) {
          if (err) {
            push(err);
          } else if (result) {
            console.log('Pushing grain', numQueued);
            push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
                                 x.timecode, x.flow_id, x.source_id, x.duration));
          }
          next();
        });
        // Removing .. was causing back pressure to fail
        // allow a number of packets to queue ahead
        // if (numQueued < 2) {
        //   next();
        // }
      } else {
        push(null, x);
        next();
      }
    }
  };

  function calculateSampleSize(tags) {
    if (tags.format[0] === 'video') {
      return ((tags.packing[0] === 'pgroup') ?
        +tags.width[0] * 5 / 2|0 :
        (+tags.width[0] + (47 - (+tags.width[0] - 1) % 48)) * 8 / 3|0
      ) * +tags.height[0];
    } else { // TODO work with ancillary data packets
      return +tags.channels[0] * +tags.encodingName[0].substring(1) / 8|0;
    }
  }

  return H.pipeline(H.consume(grainMuncher));
}
