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

function pGroupToValues(b, c) {
  c[0] = (b[0] << 2) | (b[1] & 0xc0) >> 6; // Cb0
  c[1] = (b[1] & 0x3f) << 4 | (b[2] & 0xf0) >> 4; // Y0
  c[2] = (b[2] & 0x0f) << 6 | (b[3] & 0xf3) >> 2; // Cr0
  c[3] = (b[3] & 0x03) << 8 | b[4]; //Y1

  c[4] = (b[5] << 2) | (b[6] & 0xc0) >> 6; // Cb1
  c[5] = (b[6] & 0x3f) << 4 | (b[7] & 0xf0) >> 4; // Y2
  c[6] = (b[7] & 0x0f) << 6 | (b[8] & 0xf3) >> 2; // Cr1
  c[7] = (b[8] & 0x03) << 8 | b[9]; // Y3

  c[8] = (b[10] << 2) | (b[11] & 0xc0) >> 6; // Cb2
  c[9] = (b[11] & 0x3f) << 4 | (b[12] & 0xf0) >> 4; // Y4
  c[10] = (b[12] & 0x0f) << 6 | (b[13] & 0xf3) >> 2; // Cr2
  c[11] = (b[13] & 0x03) << 8 | b[14]; // Y5
}

function valuesToPGroup(c, b) {
  b[0] = c[0] >> 2;
  b[1] = (c[0] & 0x0003) << 6 | (c[1] >> 4);
  b[2] = (c[1] & 0x000f) << 4 | (c[2] >> 6);
  b[3] = (c[2] & 0x003f) << 2 | (c[3] >> 8);
  b[4] = c[3] & 0x00ff;

  b[5] = c[4] >> 2;
  b[6] = (c[4] & 0x0003) << 6 | (c[5] >> 4);
  b[7] = (c[5] & 0x000f) << 4 | (c[6] >> 6);
  b[8] = (c[6] & 0x003f) << 2 | (c[7] >> 8);
  b[9] = c[7] & 0x00ff;

  b[10] = c[8] >> 2;
  b[11] = (c[8] & 0x0003) << 6 | (c[9] >> 4);
  b[12] = (c[9] & 0x000f) << 4 | (c[10] >> 6);
  b[13] = (c[10] & 0x003f) << 2 | (c[11] >> 8);
  b[14] = c[11] & 0x00ff;
}

function v210ToValues(b, c) {
  c[0] = b[0] | (b[1] & 0x03) << 8; // Cb0
  c[1] = (b[1] >> 2) | (b[2] & 0x0f) << 6; // Y0
  c[2] = (b[2] >> 4) | (b[3] & 0x3f) << 4; // Cr0

  c[3] = b[4] | (b[5] & 0x03) << 8; // Y1
  c[4] = (b[5] >> 2) | (b[6] & 0x0f) << 6; // Cb 1
  c[5] = (b[6] >> 4) | (b[7] & 0x3f) << 4; // Y2

  c[6] = b[8] | (b[9] & 0x03) << 8; // Cr 1
  c[7] = (b[9] >> 2) | (b[10] & 0x0f) << 6; // Y3
  c[8] = (b[10] >> 4) | (b[11] & 0x3f) << 4; // Cb 2

  c[9] = b[12] | (b[13] & 0x03) << 8; // Y4
  c[10] = (b[13] >> 2) | (b[14] & 0x0f) << 6; // Cr 2
  c[11] = (b[14] >> 4) | (b[15] & 0x3f) << 4; // Y5
}

function valuesToV210(c, b) {
  b[0] = c[0] & 0x00ff;
  b[1] = (c[0] >> 8) | (c[1] & 0x003f) << 2;
  b[2] = (c[1] >> 6) | (c[2] & 0x000f) << 4;
  b[3] = c[2] >> 4;

  b[4] = c[3] & 0x00ff;
  b[5] = (c[3] >> 8) | (c[4] & 0x003f) << 2;
  b[6] = (c[4] >> 6) | (c[5] & 0x000f) << 4;
  b[7] = c[5] >> 4;

  b[8] = c[6] & 0x00ff;
  b[9] = (c[6] >> 8) | (c[7] & 0x003f) << 2;
  b[10] = (c[7] >> 6) | (c[8] & 0x000f) << 4;
  b[11] = c[8] >> 4;

  b[12] = c[9] & 0x00ff;
  b[13] = (c[9] >> 8) | (c[10] & 0x003f) << 2;
  b[14] = (c[10] >> 6) | (c[11] & 0x000f) << 4;
  b[15] = c[11] >> 4;
}

var v = new Buffer(16)
var p = new Buffer(15)

var c = new Uint8Array(12)

function one() {
  for ( var i = 0 ; i < 460800 ; i++ ) {
    v210ToValues(v, c);
    valuesToPGroup(c, p);
  }
}

var d = Date.now();
for ( var x = 0 ; x < 250 ; x++ ) { one() };
console.log(Date.now() - d);
