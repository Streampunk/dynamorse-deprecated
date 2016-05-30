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

var Format = require('../util/Format.js');

/**
 * Create a new RTP packet from the given buffer or of the given size.
 * @constructor
 * @param {(Buffer|Number)=} b Buffer containing RTP packet data, or a number
 *                             for the size to initialize the buffer. If the
 *                             parameter is ommitted, the default size of 1500
 *                             is used.
 * @return {(RTPPacket|Error)} Newly created packet or an error if the parameter
 *                             was out of range.
 */
function RTPPacket (b) {
  if (!b) b = 1500;
  if (typeof b === 'number') {
    b = this.initBuffer(b|0);
    if (!Buffer.isBuffer(b)) // must be an Error
      return b;
  }
  if (!Buffer.isBuffer(b))
    return new Error('RTP packet is created from a Javascript Buffer.');

  this.extensions = undefined;
  this.buffer = b;
  return this;
}

/**
 * Initialize a buffer ready to hold RTP packet data.
 * @param {number} size Number of bytes for the total RTP packet buffer,
 *                      including headers, extension and payloads.
 * @return {(Buffer|Error)} A buffer of the correct size with version set to 2
 *                          and payload type initialized to 96.
 */
RTPPacket.prototype.initBuffer = function (size) {
  if (!size || typeof size !== 'number')
    return new Error('A number parameter is required to initialize a buffer.');
  if (size < 100)
    return new Error('Size of RTP packet is too small. Must be' +
      'greater than 99.');
  var b = new Buffer(size).fill(0);
  b[0] = 0x80; // Version = 2, padding = false, extension = false, csrc = 0
  b[1] = 96; // Marker = false, payload type = 96 (should be as SDP file 96-127)
  // Sequence number, timestamp and sstc not set here
  return b;
}

/**
 * Get the RTP version number stored in the RTP acket header. Defualt value is 2.
 * @return {number} RTP version number.
 */
RTPPacket.prototype.getVersion = function () {
  return (this.buffer[0] & 0xc0) >> 6;
}

/**
 * Set the RTP version number stored in the RTP packet header. Default value 2 and
 * acceptable range is 0 to 3 inclusive.
 * @param {number} v RTP version number.
 */
RTPPacket.prototype.setVersion = function (v) {
  if (typeof v !== 'number' || v < 0 || v > 3)
    return new Error('Cannot set version to a value other than 0, 1, 2 or 3.');
  v = v|0;
  this.buffer[0] = (this.buffer[0] & 0x3f) | (v << 6);
  return v;
}

RTPPacket.prototype.getPadding = function () {
  return (this.buffer[0] & 0x20) != 0;
}

RTPPacket.prototype.setPadding = function (p) {
  if (typeof p !== 'boolean')
    return new Error('Cannot set padding flag to a non-boolean value.');
  this.buffer[0] = (this.buffer[0] & 0xdf) | ((p) ? 0x20 : 0x00);
  return p;
}

RTPPacket.prototype.getExtension = function () {
  return (this.buffer[0] & 0x10) != 0;
}

RTPPacket.prototype.setExtension = function (x) {
  if (typeof x !== 'boolean')
    return new Error('Caanot set extension flag to a non-boolean value.');
  this.buffer[0] = (this.buffer[0] & 0xef) | ((x) ? 0x10 : 0x00);
  return x;
}

RTPPacket.prototype.getCSRCCount = function () {
  return this.buffer[0] & 0x0f;
}

RTPPacket.prototype.setCSRCCount = function (c) {
  if (typeof c !== 'number' || c < 0 || c > 0x0f)
    return new Error('The CSRC count number must be a number between 0 and 15.');
  this.buffer[0] = (this.buffer[0] & 0xf0) | c;
  return c;
}

RTPPacket.prototype.getMarker = function () {
  return (this.buffer[1] & 0x80) != 0;
}

RTPPacket.prototype.setMarker = function (m) {
  if (typeof m !== 'boolean')
    return new Error('Cannot set marker flag to a non-boolean value.');
  this.buffer[1] = (this.buffer[1] & 0x7f) | ((m) ? 0x80 : 0x00);
  return m;
}

RTPPacket.prototype.getPayloadType = function () {
  return this.buffer[1] & 0x7f;
}

RTPPacket.prototype.setPayloadType = function(p) {
  if (typeof p !== 'number' || p < 0 || p > 127)
    return new Error('Payload type must be a number between 0 and 127.');
  p = p|0;
  this.buffer[1] = (this.buffer[1] & 0x80) | p;
  return p;
}

RTPPacket.prototype.getSequenceNumber = function () {
  return this.buffer.readUInt16BE(2);
}

RTPPacket.prototype.setSequenceNumber = function (s) {
  if (typeof s !== 'number' || s < 0 || s > 65535)
    return new Error('Sequence number must be a number between 0 and 65535.');
  s = s|0;
  this.buffer[2] = s >> 8;
  this.buffer[3] = s & 0xff;
  return s;
}

RTPPacket.prototype.getTimestamp = function () {
  return this.buffer.readUInt32BE(4);
}

RTPPacket.prototype.setTimestamp = function (t) {
  if (typeof t !== 'number' || t < 0 || t > 0xffffffff)
    return new Error('Timestamp must be a 32-bit unsigned integer.');
  t = t>>>0;
  this.buffer.writeUInt32BE(t, 4);
  return t;
}

RTPPacket.prototype.getSyncSourceID = function () {
  return this.buffer.readUInt32BE(8);
}

RTPPacket.prototype.setSyncSourceID = function (s) {
  if (typeof s !== 'number' || s < 0 || s > 0xffffffff)
    return new Error('Synchronization source identifiers must be 32-bit unsigned integers.');
  s = s >>> 0;
  // console.log(this.buffer.length);
  this.buffer.writeUInt32BE(s, 8);
  return s;
}

RTPPacket.prototype.getContributionSourceIDs = function () {
  var a = [];
  for ( var x = 0 ; x < this.getCSRCCount() ; x++ )
    a.push(this.buffer.readUInt32BE(12 + (x * 4)));
  return a;
}

RTPPacket.prototype.setContributionSourceIDs = function (c) {
  if (!c || !Array.isArray(c))
    return new Error('Contribution source identifiers must be an array.')
  if (!c.every(function (x) {
      return x && typeof x === 'number' && x >= 0 && x <= 0xffffffff; }))
    return new Error('Each contribution source identifier must be a 32-bit ' +
      'unsigned integer.');
  c = c.map(function (x) { return x|0; });
  this.setCSRCCount(c.length);
  for ( var x = 0 ; x < c.length ; x++)
    this.buffer.writeUInt32BE(c[x], 12 + x * 4);
  return c;
}

// More extensive parsing of extensions requires SDP information
RTPPacket.prototype.getExtensions = function () {
  if (this.extensions !== undefined) return this.extensions;
  if (!this.getExtension()) return undefined;
  var extensionBase = 12 + this.getCSRCCount() * 4;
  var profile = this.buffer.readUInt16BE(extensionBase);
  var length  = this.buffer.readUInt16BE(extensionBase + 2);
  var extensionEnd = extensionBase + 4 + 4 * length;
  if (!profile === 0xbede)
    return {
      profile : profile,
      length : length,
      extensionData : this.buffer.slice(extensionBase + 4, extensionEnd) };
  var position = extensionBase + 4;
  var e = { profile : profile, length : length };
  while (position < extensionEnd) {
    if (this.buffer[position] === 0) { // skip past padding
      position++;
    }
    else {
      var id = (this.buffer[position] & 0xf0) >> 4;
      var len = (this.buffer[position] & 0x0f) + 1;
      e['id' + id] = this.buffer.slice(position + 1, position + 1 + len);
      position += 1 + len;
    }
  }
  this.extensions = e;
  return e;
}

RTPPacket.prototype.setExtensions = function (x) {
  if (!x || typeof x !== 'object' )
    return new Error('Extensions can only be set using an object.');
  if (!x.profile || typeof x.profile != 'number' || x.profile < 0 ||
      x.profile > 65535)
    return new Error('Cannot set extensions unless a profile property exists, ' +
        'is a number in the range 0 to 65535.');
  var extensionBase = 12 + this.getCSRCCount() * 4;
  var preserveLineData = new Buffer(this.buffer.slice(this.getPayloadStart(),
    this.getPayloadStart() + 30));
  if (x.profile !== 0xbede) {
    if (!x.extensionData || !Buffer.isBuffer(x.extensionData))
      return new Error('Extension data must be provided as property extensionData ' +
          'of type Buffer.');
    var length = (x.length && typeof x.length === 'number' &&
        x.length > 0 && x.length <= x.extensionData.length) ? x.length : x.extensionData.length;
    length = (length <= 65535) ? length : 65535;
    length = (length >= 0) ? length : 0;
    this.buffer.writeUInt16BE(x.profile, extensionBase);
    this.buffer.writeUInt16BE(length, extensionBase + 2);
    x.extensionData.copy(this.buffer, extensionBase, 0, length);
    this.setExtension(true);
    preserveLineData.copy(this.buffer, this.getPayloadStart());
    return x;
  } else {
    var position = extensionBase + 4;
    Object.keys(x).forEach(function (k) {
      var id = k.match(/id([1-9][1-4]?)/);
      if (id) {
        id = +id[1];
        var buf = x[`id${id}`];
        if (buf && Buffer.isBuffer(buf)) {
          var len = (buf.length < 17) ? buf.length - 1 : 15; // 15 == 16
          this.buffer[position] = (id << 4) | len;
          buf.copy(this.buffer, position + 1, 0, len + 1);
          position += len + 2;
        }
      }
    }.bind(this));
    while ((position - extensionBase) % 4 !== 0) { this.buffer[position++] = 0; }
    this.buffer.writeUInt16BE(x.profile, extensionBase);
    this.buffer.writeUInt16BE((position - extensionBase - 4) / 4, extensionBase + 2);
    this.setExtension(true);
    preserveLineData.copy(this.buffer, this.getPayloadStart());
    return this.getExtensions();
  }
}

RTPPacket.prototype.isStart = function (grain_flags_id) {
  var e = this.getExtensions();
  if (typeof e === 'object' && Buffer.isBuffer(e['id' + grain_flags_id])) {
    return (e['id' + grain_flags_id][0] & 0x80) !== 0;
  }
  return false;
}

RTPPacket.prototype.isEnd = function (grain_flags_id) {
  var e = this.getExtensions();
  if (typeof e === 'object' && Buffer.isBuffer(e['id' + grain_flags_id])) {
    return (e['id' + grain_flags_id][0] & 0x40) !== 0;
  }
  return false;
}

RTPPacket.prototype.getPayloadStart = function() {
  if (!this.getExtension()) {
    return 12 + this.getCSRCCount() * 4;
  } else {
    var extensionBase = 12 + this.getCSRCCount() * 4
    var length = this.buffer.readUInt16BE(extensionBase + 2);
    return extensionBase + 4 + 4 * length;
  }
}

RTPPacket.prototype.getPayload = function () {
  return this.buffer.slice(this.getPayloadStart());
}

RTPPacket.prototype.setPayload = function (p) {
  if (!p || !Buffer.isBuffer(p))
    return new Error('Cannot set the payload with anything other than a Buffer.');
  var start = this.getPayloadStart();
  var copied = p.copy(this.buffer, start);
  if (this.buffer.length > start + copied) {
    this.buffer = this.buffer.slice(0, start + copied);
  }
  return copied;
}

RTPPacket.prototype.shrinkPayload = Format.shrinkPayload;

RTPPacket.prototype.toJSON = function () {
  return {
    version : this.getVersion(),
    padding : this.getPadding(),
    extension : this.getExtension(),
    csrcCount : this.getCSRCCount(),
    marker : this.getMarker(),
    payloadType : this.getPayloadType(),
    sequenceNumber : this.getSequenceNumber(),
    timestamp : this.getTimestamp(),
    syncSourceID : this.getSyncSourceID(),
    contributionSourceIDs : this.getContributionSourceIDs(),
    extensions : this.getExtensions(),
    payload : this.shrinkPayload(this.getPayload())
  };
}

module.exports = RTPPacket;
