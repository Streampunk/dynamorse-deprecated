/* Copyright 2015 Christine S. MacNeill

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

function SDP(sdp) {
  if (sdp == null || sdp == undefined) return {};
  if (Buffer.isBuffer(sdp)) {
    sdp = sdp.toString();
  }
  if (typeof sdp !== 'string') return {};
  return this.stringToSDPObject(sdp);
}

// Need to push the m attributes into groups.
SDP.prototype.stringToSDPObject = function (s) {
  var sdp = { m : [] };
  var media = sdp;
  var sdpLines = s.split(/\r?\n/);
  sdpLines.forEach(function (l) {
    var m = l.trim().match(/^([a-z])=(.*)$/)
    if (m !== null) {
      if (m[1] === 'm') {
        media = {};
        sdp.m.push(media);
      }
      if (media[m[1]] === undefined) {
        if (m[1] === 'a') {
          console.log("processing an a", l);
          var n = m[2].match(/^([^\r\n:]+):?([^\r\n]+)$/);
          if (n !== null) {
            media.a = {};
            media.a[n[1]] = (n[2] === undefined) ? null : [ n[2] ];
          }
        } else {
          media[m[1]] = [ m[2] ];
        }
      } else {
        if (m[1] === 'a') {
          var n = m[2].match(/^([^\r\n:]+):?([^\r\n]+)$/);
          if (n !== null) {
            if (media.a[n[1]] === null || media.a[n[1]] === undefined) {
              media.a[n[1]] = [ n[2] ];
            } else {
              media.a[n[1]].push(n[2]);
            }
          }
        } else {
          media[m[1]].push(m[2]);
        }
      }
    }
  });
  return sdp;
}

module.exports = SDP;
