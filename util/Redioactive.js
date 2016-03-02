/* Copyright 2016 Christine S. MacNeill

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

// Reactive streams library for Node-RED nodes.

function End() { }

End.prototype.toString = function () { return 'End'; };
var isEnd = function (x) {
  return x !== null &&
    typeof x === 'object' &&
    x.constructor === End.prototype.constructor;
}
var theEnd = new End;

module.exports = {
  end : theEnd,
  isEnd : isEnd
};
