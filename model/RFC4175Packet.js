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

var RTPPacket = require('./RTPPacket.js');

function RFC4175Packet (b) {
  RTPPacket.call(this, b);
}

RFC4175Packet.prototype = Object.create(RTPPacket.prototype);
RFC4175Packet.prototype.constructor = RFC4175Packet;

RFC4175Packet.prototype.getExtendedSequenceNumber = function () {
  return this.buffer.readUInt16BE(this.getPayloadStart());
}

RFC4175Packet.prototype.getCompleteSequenceNumber = function () {
  return (this.getExtendedSequenceNumber() << 16) | this.getSequenceNumber();
}

RFC4175Packet.prototype.getLineData = function () {
  var lineDataStart = this.getPayloadStart() + 2;
  var continuation = true;
  var lines = [];
  while (continuation) {
    var line = {
      length : this.buffer.readUInt16BE(lineDataStart),
      lineNo : this.buffer.readUInt16BE(lineDataStart + 2) & 0x7fff,
      offset : this.buffer.readUInt16BE(lineDataStart + 4) & 0x7fff,
      fieldID : (this.buffer[lineDataStart + 2] & 0x80) !== 0,
      continuation : (this.buffer[lineDataStart + 4] & 0x80) !== 0
    };
    continuation = line.continuation;
    lineDataStart += 6;
    lines.push(line);
  }
  for ( var x = 0 ; x < lines.length ; x++ ) {
    lines[x].data =
      this.buffer.slice(lineDataStart, lineDataStart + lines[x].length);
    lineDataStart += lines[x].length;
  }
  return lines;
}

RFC4175Packet.prototype.toJSON = function () {
  var j = RTPPacket.prototype.toJSON.call(this);
  console.log(this, this.shrinkPayload);
  j.extendedSequenceNumber = this.getExtendedSequenceNumber();
  j.lines = this.getLineData().map(function (l) {
    return { length : l.length, lineNo : l.lineNo, offset : l.offset,
      fieldID : l.fieldID, continuation : l.continuation,
      data : this.shrinkPayload(l.data) };
  }.bind(this));
  return j;
}

module.exports = RFC4175Packet;
