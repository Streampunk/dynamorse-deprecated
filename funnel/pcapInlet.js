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

var fs = require('fs');
var H = require('highland');

function pcapInlet(file, loop) {
  var nextLen = 0;
  var chunks = 0;
  var packets = 0;
  var leftOver = null;
  var breakInHeader = false;
  var pcapConsumer = function (err, b, push, next) {
    if (err) {
      push(err);
      next();
    }
    else if (b === H.nil) {
      push(null, b);
      //  stream.close();
    }
    else {
      chunks++;
      var packetEnd = 0;
      // The following condition creates either a year 2055 or 2083 problem!
      // Detects pcap magic number of 0xd4c3b2a1
      if ((chunks === 1) ||
           ((leftOver.length === 0) && ((b.readUInt32LE(0) === 0xa1b2c3d4) ||
           (b.readUInt32BE(0) === 0xa1b2c3d4)))) {
        packetEnd = 24;
        breakInHeader = false;
      } else {
        if (!breakInHeader) {
          push(null, Buffer.concat([leftOver, b], nextLen).slice(42));
          packets++;
          packetEnd = nextLen - leftOver.length;
        }
      }

      while (packetEnd < b.length) {
        var packetHeader = (breakInHeader) ?
          Buffer.concat([leftOver, b.slice(0, 16 - leftOver.length)], 16) :
          b.slice(packetEnd, packetEnd + 16);
        nextLen = packetHeader.readUInt32LE(8);
        packetEnd += (breakInHeader) ? 16 - leftOver.length : 16;
        if (packetEnd + nextLen <= b.length) {
          push(null, b.slice(packetEnd + 42, packetEnd + nextLen));
          packets++;
          packetEnd += nextLen;
          breakInHeader = false;
          if (b.length - packetEnd < 16) {
            leftOver = b.slice(packetEnd);
            breakInHeader = true;
            packetEnd = b.length;
          }
        } else {
          leftOver = b.slice(packetEnd);
          packetEnd = b.length;
          breahInHeader = false;
        }
      }

      // console.log('Calling Highland next');
      next();
    }
  }

  var lumps = 0;
  return H(function (push, next) {
      push(null, H(fs.createReadStream(file)));
      next();
    })
    .take(loop ? Number.MAX_SAFE_INTEGER : 1)
    .sequence()
    .consume(pcapConsumer);
}

module.exports = pcapInlet;
