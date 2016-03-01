/* Copyright 2015 Christine S. MacNeill

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

var q = [];

var start = Date.now();

for ( var x = 0 ; x < 1000 ; x++ ) {
  for ( var y = 0 ; y < 1000 ; y++) q.push(y);
  for ( var y = 0 ; y < 1000 ; y++) q.shift();
  q.length;
}

var end = Date.now();
console.log(end - start);
