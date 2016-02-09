/* Copyright 2016 Christine S. MacNeill

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by appli cable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var Grain = require('../model/Grain.js');
var codecadon = require('../../codecadon');
var H = require('highland');

module.exports = function() {
  var encoder = new codecadon.Encoder(0);

  encoder.start();
  encoder.on('exit', function() {
    console.log('Encoder exiting');
  });

  var grainMuncher = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      encoder.quit();
      push(null, H.nil);
    } else {
      if (Grain.isGrain(x)) {
        encoder.once('encoded', function(result) {
          push(null, new Grain(result, x.ptpSync, x.ptpOrigin, 
                               x.timecode, x.flow_id, x.source_id, x.duration));
          next();
        });
        encoder.once('error', function(err) {  
          push (err);
          next();
        });    
        encoder.encode(x.buffers);
      } else {
        push(null, x);
        next();
      }
    }
  };

  return H.pipeline(H.consume(grainMuncher));
}
