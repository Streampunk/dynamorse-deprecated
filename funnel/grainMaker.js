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

var H = require('highland');
var uuid = require('uuid');
var Grain = require('../model/Grain.js');

function nanoTime() {
  var nt = process.nanoTime();
  return nt[0] * 1e9 * nt[1];
}

function ptpToBuffer(secs, nanos) {
  var b = new Buffer(10);
  b.writeUIntBE(secs, 0, 6);
  b.writeUInt32BE(nanos, 6);
  return b;
}

function grainMaker(rateNumerator, rateDenominator, flowID, sourceID) {
  var start = Date.now() / 1000|0;
  var baseNanos = 0;
  var count = 0;

  function diffTime() {
    return nanoTime() - baseNanos;
  }

  console.log(flowID, sourceID);
  if (!Buffer.isBuffer(flowID))
    flowID = new Buffer(uuid.parse(flowID));
  if (!Buffer.isBuffer(sourceID))
    sourceID = new Buffer(uuid.parse(sourceID))
  console.log(flowID, sourceID);
  var timecode = new Buffer(8).fill(0);
  var duration = new Buffer(8);
  duration.writeUInt32BE(rateNumerator, 0);
  duration.writeUInt32BE(rateDenominator, 4);

  var grainGenerator = function (push, next) {
    var increment = baseNanos + count * rateDenominator * 1e9 / rateNumerator;
    var ptp = ptpToBuffer(start + increment/1e9|0, increment % 1e9);
    var g = new Grain([], ptp, ptp, timecode, flowID, sourceID, duration);
    push(null, g)
    next();
    count++;
  }

  return H(grainGenerator);
}

module.exports = grainMaker;
