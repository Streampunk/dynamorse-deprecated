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

// TODO: Change to link binding
var macadam = require('../../macadam');
var H = require('highland');

module.exports = function (deviceIndex, displayMode, pixelFormat, stopper) {
  var c = new macadam.Capture(deviceIndex, displayMode, pixelFormat);
  var frameStream = H('frame', c);
  var errorStream = H('error', c);
  c.on('removeListener', function (event, listener) {
    console.log('Stopping macadam capture.');
    if (c.listenType('frame') === 0) c.stop();
  });
  stopper(c.stop.bind(c));
  c.start();
  return H.merge([errorStream, frameStream]);
}
