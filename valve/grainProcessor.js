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
var H = require('highland');

module.exports = function(process) {
  process.on('exit', function() {
    console.log('Process exiting');
    process.finish();
  });
  process.on('error', function(err) {
    console.log('Process error: ' + err);
  });
  var dstBufLen = process.start();

  var grainMuncher = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      process.quit(function() {
        push(null, H.nil);
      });
    } else {
      if (Grain.isGrain(x)) {
        var dstBuf = new Buffer(dstBufLen);
        var numQueued = process.doProcess(x.buffers, dstBuf, function(err, result) {
          if (err) {
            push(err);
          } else if (result) {
            push(null, new Grain(result, x.ptpSync, x.ptpOrigin, 
                                 x.timecode, x.flow_id, x.source_id, x.duration));
          }
          next();
        });
        // allow a number of packets to queue ahead
        if (numQueued < 2) { 
          next(); 
          }
      } else {
        push(null, x);
        next();
      }
    }
  };

  return H.pipeline(H.consume(grainMuncher));
}
