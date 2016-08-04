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

var b = fs.readFileSync('scratch/frame0.h264');

const START = 1;
const START_ZERO = 12;
const START_ZERO_ZERO = 13;
const START_ZERO_ZERO_ONE = 14;
const ZERO = 2;
const ZERO_ZERO = 3;
const ZERO_ZERO_ONE = 4;
const DATA = 5;
var state = START;
var rangePointer = 0;
var endPointer = 0;
var nals = { slices : [] , seis : [], max_ref_idc : 0 };

function changeState(s) {
  // console.log('Changing state', state, 'to', s, 'with start', rangePointer,
  //   'and end', endPointer);
  state = s;
}

function testMaxRefIDC(value) {
  if (value & 0x60 > nals.max_ref_idc)
   nals.max_ref_idc = value & 0x60;
  return value & 0x1f;
}

function nextNAL(nal) {

  switch (testMaxRefIDC(nal[0])) {
    case 9:
      nals.aud = nal;
      nals.max_ref_idc = (nal[0])
      break;
    case 7:
      nals.sps = nal;
      break;
    case 8:
      nals.pps = nal;
      break;
    case 6:
      nals.sei.push(nal);
      break;
    case 5:
      nals.slices.push(nal);
      break;
    default:
      console.log('Unexpected NAL unit type.');
      break;
  }
}

console.log('Starting');
for ( var x = 0 ; x < b.length ; x++ ) {
  switch (state) {
    case START:
      if (b[x] === 0) changeState(START_ZERO);
      break;
    case START_ZERO:
      if (b[x] === 0) changeState(START_ZERO_ZERO);
      else changeState(START);
      break;
    case START_ZERO_ZERO:
      switch (b[x]) {
        case 0: changeState(START_ZERO_ZERO); break;
        case 1: changeState(START_ZERO_ZERO_ONE); break;
        default: changeState(START); break;
      }
      break;
    case START_ZERO_ZERO_ONE:
      rangePointer = x;
      changeState(DATA);
      break;
    case DATA:
      if (b[x] === 0) changeState(ZERO);
      else changeState(DATA);
      break;
    case ZERO:
      endPointer = x - 1;
      if (b[x] === 0) changeState(ZERO_ZERO);
      else changeState(DATA);
      break;
    case ZERO_ZERO:
      switch (b[x]) {
        case 0: changeState(ZERO_ZERO); break;
        case 1: changeState(ZERO_ZERO_ONE); break;
        default: changeState(DATA); break;
      }
      break;
    case ZERO_ZERO_ONE:
      nextNAL(b.slice(rangePointer, endPointer));
      rangePointer = x;
      changeState(DATA);
      break;
    default:
      console.error('Unknown state.');
      break;
  }
}
if (state === DATA) endPointer = b.length;
if (endPointer > rangePointer) nextNAL(b.slice(rangePointer, endPointer));
console.log(nals);

var statA = new Buffer(nals.aud.length + nals.sps.length +
  nals.pps.length + 7);

var pos = 3;
statA.writeUInt8(nals.max_ref_idc | 24, 0);
statA.writeUInt16BE(nals.aud.length, 1);
pos += nals.aud.copy(statA, pos);
statA.writeUInt16BE(nals.sps.length, pos);
pos += 2;
pos += nals.sps.copy(statA, pos);
statA.writeUInt16BE(nals.pps.length, pos);
pos += 2;
nals.pps.copy(statA, pos);

console.log(statA);

nals.slices.forEach(function (x) {
  var p = new Buffer(1410);
  p.writeUInt8(nals.max_ref_idc | 28, 0);
  p.writeUInt8(0x80 | (x[0] & 0x1f), 1);
  var written = x.copy(p, 2);
  console.log(written, p);
});
