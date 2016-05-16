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

module.exports = {
  shrinkPayload : function (b) {
    function byteToHex (x) {
      var s = x.toString(16); return (s.length == 1) ? '0' + s : s; }
    var shrunk = "<Buffer ";
    var firstTen = b.slice(0, 10);
    for ( var x = 0 ; x < firstTen.length ; x++ )
      shrunk += byteToHex(firstTen[x]) + ' ';
    shrunk += "... " + b.length + " bytes";
    if (b.length > 10) {
      shrunk += " ...";
      var lastTen = b.slice((b.length < 15) ? 5 - b.length : -5);
      for ( var x = 0 ; x < lastTen.length ; x++ )
        shrunk += ' ' + byteToHex(lastTen[x]);
    }
    shrunk += '>';
    return shrunk;
  }
}
