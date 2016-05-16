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
 * Dump a stream of [buffers]{@link Buffer} to the console.
 * @module bufferDump
 */


/**
 * Returns a counting highland stream buffer callback.
 * @function
 * @return {Function} Counting buffer dumper for a highland stream callback.
 */
var bufferDump = module.exports = function () {
  var count = 0;
  function logNext(b) {
    console.log(count, Format.shrinkPayload(b));
    count++;
  }
  return logNext;
}
