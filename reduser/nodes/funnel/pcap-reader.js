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

var util = require('util');
var fs = require('fs');
var redioactive = require('../../../util/Redioactive.js');

module.exports = function (RED) {
  function PCAPReader (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);
    var stream = fs.createReadStream('/Users/vizigoth/Documents/streampunk/nmi/phase1/examples/rtp-video-rfc4175-1080i50-colour.pcap');
    var nextLen = 0;
    var chunks = 0;
    var packets = 0;
    var leftOver = null;
    var breakInHeader = false;
    this.generator(function (push, next) {
      stream.once('readable', function () {
        var b = stream.read();
        if (b === null) {
          return push (null, redioactive.End);
        }
        chunks++;
        var packetEnd = 0;
        if (chunks === 1) {
          packetEnd = 24;
        } else {
          if (!breakInHeader) {
            push(null, Buffer.concat([leftOver, b], nextLen).slice(42).length);
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
          if (packetEnd + nextLen <= b.length) {
            push(null, b.slice(packetEnd + 42, packetEnd + nextLen).length);
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
      });
    });

    this.on('close', this.close);
  }
  util.inherits(PCAPReader, redioactive.Funnel);
  RED.nodes.registerType("pcap-reader", PCAPReader);
}
