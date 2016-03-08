/* Copyright 2016 Christine S. MacNeill

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
var codecadon = require('../../../../codecadon');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function Converter (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);

    var converter = new codecadon.ScaleConverter(config.dstFormat, +config.dstWidth, +config.dstHeight);
    converter.on('exit', function() {
      console.log('Converter exiting');
      converter.finish();
    });
    converter.on('error', function(err) {
      console.log('Converter error: ' + err);
    });
    var dstBufLen = converter.start();

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        converter.quit(function() {
          push(null, x);
        });
      } else {
        if (Grain.isGrain(x)) {
          var dstBuf = new Buffer(dstBufLen);
          var numQueued = converter.scaleConvert(x.buffers, +config.srcWidth, +config.srcHeight, config.srcFormat, dstBuf, function(err, result) {
            if (err) {
              push(err);
            } else if (result) {
              push(null, new Grain(result, x.ptpSync, x.ptpOrigin, 
                                   x.timecode, x.flow_id, x.source_id, x.duration));
            }
            next();
          });
          // allow a number of packets to queue ahead
          if (numQueued < +config.maxBuffer) { 
            next(); 
            }
        } else {
          push(null, x);
          next();
        }
      }
    });
    this.on('close', this.close);
  }
  util.inherits(Converter, redioactive.Valve);
  RED.nodes.registerType("converter", Converter);
}
