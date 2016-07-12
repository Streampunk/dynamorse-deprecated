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

var RTPPacket = require('./RTPPacket.js');

function RFC4175Packet (b) {
  this.lineCount = 0;
  RTPPacket.call(this, b);
}

RFC4175Packet.prototype = Object.create(RTPPacket.prototype);
RFC4175Packet.prototype.constructor = RFC4175Packet;

RFC4175Packet.prototype.getExtendedSequenceNumber = function () {
  return this.buffer.readUInt16BE(this.getPayloadStart());
}

RFC4175Packet.prototype.setExtendedSequenceNumber = function (n) {
  this.buffer.writeUInt16BE(n, this.getPayloadStart());
}

RFC4175Packet.prototype.getCompleteSequenceNumber = function () {
  return (this.getExtendedSequenceNumber() << 16) | this.getSequenceNumber();
}

RFC4175Packet.prototype.setCompleteSequenceNumber = function (n) {
  this.setExtendedSequenceNumber(n >>> 16);
  this.setSequenceNumber(n & 65535);
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
  this.lineCount = lines.length;
  for ( var x = 0 ; x < lines.length ; x++ ) {
    lines[x].data =
      this.buffer.slice(lineDataStart, lineDataStart + lines[x].length);
    lineDataStart += lines[x].length;
  }
  return lines;
}

/*
 * Line status is an object with linePos, lineNo, width, height, stride, bytesPerLine,
 *   fieldBreak.
 */
RFC4175Packet.prototype.setLineDataHeaders = function (lineStatus, remaining) {
  var lineDataStart = this.getPayloadStart() + 2;
  var packetPos = 0;
  this.lineCount = 0;
  while (packetPos < remaining) {
    var bytesLeftOnLine = lineStatus.bytesPerLine - lineStatus.linePos;
    if (bytesLeftOnLine <= remaining) {
      this.buffer.writeUInt16BE(bytesLeftOnLine, lineDataStart);
      this.buffer.writeUInt16BE(lineStatus.lineNo++ & 0x7fff, lineDataStart + 2);
      this.buffer.writeUInt16BE((lineStatus.linePos / lineStatus.byteFactor) & 0x7fff,
          lineDataStart + 4);
      if (lineStatus.fieldBreaks.field2Start && lineStatus.lineNo >= lineStatus.fieldBreaks.field2Start) {
        this.buffer[lineDataStart + 2] = this.buffer[lineDataStart + 2] | 0x80;
      }
      if (lineStatus.lineNo === lineStatus.fieldBreaks.field1End + 1) {
        lineStatus.lineNo = lineStatus.fieldBreaks.field2Start;
        this.setMarker(true); // Marker set a field boundaries
        packetPos = remaining;
      } else if (lineStatus.fieldBreaks.field2End &&
          lineStatus.lineNo === lineStatus.fieldBreaks.field2End + 1) {
        // this.setMarker(true); // Set at the grain level
        packetPos = remaining;
      } else {
        packetPos += bytesLeftOnLine;
        // Short line - must have continuation
        this.buffer[lineDataStart + 4] = this.buffer[lineDataStart + 4] | 0x80;
      }
      lineDataStart += 6;
      lineStatus.linePos = 0;
    } else {
      var space = remaining - packetPos;
      this.buffer.writeUInt16BE(space - space % lineStatus.stride, lineDataStart);
      this.buffer.writeUInt16BE(lineStatus.lineNo & 0x7fff, lineDataStart + 2);
      this.buffer.writeUInt16BE((lineStatus.linePos / lineStatus.byteFactor) & 0x7fff,
          lineDataStart + 4);
      if (lineStatus.fieldBreaks.field2Start &&
          lineStatus.lineNo > lineStatus.fieldBreaks.field2Start) {
        this.buffer[lineDataStart + 2] = this.buffer[lineDataStart + 2] | 0x80;
      }
      lineStatus.linePos += space - space % lineStatus.stride;
      packetPos = remaining;
      lineDataStart += 6;
    }
    this.lineCount++;
  }
  return lineStatus;
}

RFC4175Packet.prototype.setPayload = function (b) {
  if (!b || !Buffer.isBuffer(b))
    return new Error('Cannot set the payload with anything other than a Buffer.');
  var start = this.getPayloadStart() + this.lineCount * 6 + 2;
  var copied = b.copy(this.buffer, start);
  if (this.buffer.length > start + copied) {
    this.buffer = this.buffer.slice(0, start + copied);
  }
  return copied;
}

RFC4175Packet.prototype.toJSON = function () {
  var j = RTPPacket.prototype.toJSON.call(this);
  // console.log(this, this.shrinkPayload);
  j.extendedSequenceNumber = this.getExtendedSequenceNumber();
  j.lines = this.getLineData().map(function (l) {
    return { length : l.length, lineNo : l.lineNo, offset : l.offset,
      fieldID : l.fieldID, continuation : l.continuation,
      data : this.shrinkPayload(l.data) };
  }.bind(this));
  return j;
}

module.exports = RFC4175Packet;
