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
var Grain = require('../model/Grain.js');
var SDP = require('../model/SDP.js');

function grainZipper(metadata, essence) {

  var zipper = H.map(function(x) {
    if (Buffer.isBuffer(x[0]) && Grain.isGrain(x[1])) {
      return x[1].buffers = [x[0]];
    } else if (SDP.isSDP(x[1])) {
      return x[1];
    } else {
      return new Error("Unexpected input to grain zipper.");
    }
  });
  return H.pipeline(zip(metadata), zipper);
}
