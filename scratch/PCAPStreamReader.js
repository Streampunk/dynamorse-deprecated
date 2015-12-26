/* Copyright 2015 Christine S. MacNeill

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

var fs = require('fs');
var H = require('highland');

var pcapFile = process.argv[2];
//'/Users/vizigoth/Documents/streampunk/nmi/phase1/examples/rtp-video-rfc4175-1080i50-longer-sequence.pcap';

// var stream = fs.createReadStream(pcapFile);

function countingConsumer() {
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
      console.log('Received final chunk ' + chunks + '.');
      console.log('Total packets ' + packets);
      push(null, b);
    }
    else {
      chunks++;
      var packetEnd = 0;
      if (chunks === 1) {
        packetEnd = 24;
      } else {
        if (!breakInHeader) {
          push(null, Buffer.concat([leftOver, b], nextLen));
          packets++;
          packetEnd = nextLen - leftOver.length;
        }
      }

      while (packetEnd < b.length) {
        var packetHeader = (breakInHeader) ?
          Buffer.concat([leftOver, b.slice(0, 16 - leftOver.length)], 16) :
          b.slice(packetEnd, packetEnd + 16);
        // console.log(packetHeader);
        nextLen = packetHeader.readUInt32LE(8);
        packetEnd += (breakInHeader) ? 16 - leftOver.length : 16;
        if (packetEnd + nextLen < b.length) {
          push(null, b.slice(packetEnd, packetEnd + nextLen));
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

      next();
    }
  }
  return pcapConsumer;
}

function nextRead(x) {
  console.log('Loop', x);
  if (x <= 0) return;
  var start = Date.now();
  var stream = fs.createReadStream(pcapFile);
  H(stream).consume(countingConsumer()).done(function () {
    nextRead(x - 1);
    console.log('One cycle took ', Date.now() - start);
  });
}

nextRead(10);
