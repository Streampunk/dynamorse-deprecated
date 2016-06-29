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

var Packet = require('../model/RFC4175Packet.js');

function withPacket() {
  var t = process.hrtime();
  var a = [];
  for ( var y = 0 ; y < 3600 ; y++ )
    a.push(new Packet(new Buffer(1452)));
  return process.hrtime(t);
}

function pushNewBuffer() {
  var t = process.hrtime();
  var a = [];
  for ( var y = 0 ; y < 3600 ; y++ )
    a.push(new Buffer(1452));
  return process.hrtime(t);
}

function allocNewBuffer() {
  var t = process.hrtime();
  var a = new Array(3600);
  for ( var y = 0 ; y < 3600 ; y++ )
    a[y] = new Buffer(1452);
  return process.hrtime(t);
}

function pushBufferSlice() {
  var t = process.hrtime();
  var buf = new Buffer(1452*3600);
  var a = [];
  for ( var y = 0 ; y < 3600 * 1452 ; y += 1452 )
    a.push(buf.slice(y, y + 1452));
  return process.hrtime(t);
}

function allocBufferSlice() {
  var t = process.hrtime();
  var buf = new Buffer(1452*3600);
  var a = new Array(3600);
  for (var y = 0 ; y < 3600  ; y++ )
    a[y] = buf.slice(y*1452, y*1452 + 1452);
  return process.hrtime(t);
}

function oneBigBuffer() {
  var t = process.hrtime();
  var buf = new Buffer(1452*3600);
  var p = new Packet(buf.slice(0, 1452));
  for ( var y = 0 ; y < 3600 ; y++ )
    p.buffer = buf;
  return process.hrtime(t);
}

function testStrategy (n, wait, allocFn) {
  var totalT = process.hrtime();
  var cumulative = 0;
  var i = 0;
  function doWork() {
    var result = allocFn();
    cumulative += result[1];
    if (i < n) {
      if (i % 100 === 0) console.log(`At ${i} cumulative is ${cumulative / i / 1000000}.`);
      i++;
      setTimeout(doWork, wait - result[1] / 1000000);
    } else {
      console.log('total process time', process.hrtime(totalT),
        'cumulative avarege time', cumulative / n / 1000000);
    }
  }
  doWork();
}

module.exports = {
  withPacket : withPacket,
  pushNewBuffer : pushNewBuffer,
  allocNewBuffer : allocNewBuffer,
  pushBufferSlice : pushBufferSlice,
  allocBufferSlice : allocBufferSlice,
  oneBigBuffer : oneBigBuffer,
  testStrategy : testStrategy
};
