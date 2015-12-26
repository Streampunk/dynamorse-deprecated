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

var uuid = require('uuid');
var immutable = require('seamless-immutable');
var Timecode = require('./Timecode.js');

function Grain(buffers, ptpSync, ptpOrigin, timecode, flow_id,
    source_id, duration) {

  this.buffers = buffers;
  this.ptpSync = this.checkTimestamp(ptpSync);
  this.ptpOrigin = this.checkTimestamp(ptpOrigin);
  this.timecode = this.checkTimecode(timecode);
  this.flow_id = this.uuidToBuffer(flow_id);
  this.source_id = this.uuidToBuffer(source_id);
  this.duration = duration;
  return this;
  //return immutable(this, { prototype : Grain.prototype });
}

Grain.prototype.uuidToBuffer = function (id) {
  try {
    if (id === undefined || id === null) {
      return undefined;
    }
    if (typeof id === 'string') {
      var b = new Buffer(16);
      uuid.parse(id, b);
      return b;
    }
    if (Buffer.isBuffer(id)) {
      return id.slice(0, 16);
    }
  }
  catch (e) {
    console.log(e);
    return undefined;
  }
  console.log("Could not parse value '" + id + "' to a UUID.");
  return undefined;
}

Grain.prototype.checkTimestamp = function (t) {
  if (t === null || t === undefined) {
    return undefined;
  }
  if (Buffer.isBuffer(t)) {
    if (t.length < 10) {
      t = Buffer.concat([new Buffer(10-t.length).fill(0), t], 10);
    }
    return t.slice(-10);
  }
  if (typeof t === 'string') {
    var m = t.match(/^([0-9]+):([0-9]+)$/)
    if (m === null) {
      console.log("Could not pattern match timestamp '" + t + "'.");
      return undefined;
    }
    var b = new Buffer(10);
    b.writeUIntBE(+m[1], 0, 6);
    b.writeUInt32BE(+m[2], 6);
    return b;
  }
  return undefined;
}

var nineZeros = '000000000';

Grain.prototype.formatTimestamp = function (t) {
  if (t === null || t === undefined) return undefined
  var nanos = t.readUInt32BE(6).toString();
  return t.readUIntBE(0, 6) + ':' + nineZeros.slice(nanos.length) + nanos;
}

Grain.prototype.checkTimecode = function (t) {
  if (t === null || t === undefined) {
    return undefined;
  }
  if (Buffer.isBuffer(t)) {
    if (t.length < 8) {
      t = Buffer.concat([new Buffer(8-t.length).fill(0), t], 8);
    }
    return t.slice(-8);
  }
  if (typeof t === 'object' && t.constructor === Timecode.prototype.constructor) {
    return t.buffer;
  }
  if (typeof t === 'string') {
    return new Timecode(t).buffer;
  }
  return undefined;
}

Grain.prototype.formatTimecode = function (t) {
  if (t === null || t === undefined) return undefined;
  return new Timecode(t).toString();
}

Grain.prototype.formatDuration = function (d) {
  return d.readUInt32BE(4) + '/' + d.readUInt32BE(0);
}

Grain.prototype.toJSON = function () {
  return {
    ptpSyncTimestamp : this.formatTimestamp(this.ptpSync),
    ptpOriginTimestamp : this.formatTimestamp(this.ptpOrigin),
    timecode : this.formatTimecode(this.timecode),
    flow_id : uuid.unparse(this.flow_id),
    source_id : uuid.unparse(this.source_id),
    duration : this.formatDuration(this.duration)
  };
}

module.exports = Grain;
