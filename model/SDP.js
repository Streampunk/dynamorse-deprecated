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

// TODO: Does not parse the t and r groups correctly

var moreThanOne = {
  v: false, o: false, s : false, i: false, u: false, e: false,
  p: false, c: false, b: true, t: false, r: true, z: false,
  a: false
};

/**
 * Represents an SDP file defined according to RFC4566.
 * @constructor
 * @param [(string|Buffer)] sdp SDP data..
 */
function SDP(sdp) {
  if (sdp == null || sdp == undefined) return {};
  if (Buffer.isBuffer(sdp)) {
    sdp = sdp.toString();
  }
  if (typeof sdp !== 'string') return {};
  return this.parse(sdp, this);
}

/**
 * Parse SDP data and merge it into this SDP object.
 * @param [string] s String representation of the SDP file.
 */
SDP.prototype.parse = function (s) {
  if (this === undefined || this === null || typeof this !== 'object') {
    sdp = {};
  } else {
    sdp = this;
  }
  var media = sdp;
  var sdpLines = s.split(/\r?\n/);
  sdpLines.forEach(function (l) {
    var m = l.trim().match(/^([a-z])=(.*)$/)
    if (m !== null) {
      if (m[1] === 'm') {
        media = {};
        if (sdp.m === undefined) sdp.m = [];
        sdp.m.push(media);
      }
      if (media[m[1]] === undefined) {
        if (m[1] === 'a') {
          var n = m[2].match(/^([^\r\n:]+):?([^\r\n]+)$/);
          if (n !== null) {
            media.a = {};
            media.a[n[1]] = (n[2] === undefined) ? null : [ n[2] ];
          }
        } else {
          if (moreThanOne[m[1]]) {
            media[m[1]] = [ m[2] ];
          } else {
            media[m[1]] = m[2];
          }
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
          if (moreThanOne[m[1]]) media[m[1]].push(m[2]);
        }
      }
    }
  });
  return sdp;
}

/**
 * Array of media names available in the SDP file. The index of each
 * item can be used to reference media-item specifics.
 * @return [Array.<string>] List of available media names.
 */
SDP.prototype.getMediaHeaders = function () {
  return this.m.map(function (x) { return x.m; });
}

/**
 * If present, an object as hashmap to allow extension header
 * identifiers to be looked up.
 * @param [number] i Index into the media items to look for ExtMap.
 * @return [Object.<string, number>] Reverse lookup for extmap tables.
 */
SDP.prototype.getExtMapReverse = function (i) {
  var extMap = this.m[i].a.extmap;
  if (!Array.isArray(extMap)) return {};
  var revMap = {};
  extMap.forEach(function (x) {
    var w = x.match(/([0-9][0-9]?)\s([^\s]+)\.*/);
    if (w !== null) {
      revMap[w[2]] = +w[1];
    }
  });
  return revMap;
}

var sessionOrder =
  [ 'v', 'o', 's', 'i', 'u', 'e', 'p', 'c', 'b', 't', 'r', 'z', 'k', 'a' ];

var mediaOrder = [ 'm', 'i', 'c', 'b', 'k', 'a' ];

SDP.prototype.toString = function () {
  var sdp = '';
  sessionOrder.forEach(function (x) {
    if (x === 'a' && this.a !== undefined) {
      for ( var z in this.a ) {
        this.a[z].forEach(function (w) {
          sdp += 'a=' + z + ((w.length > 0) ? ':' : '') + w + '\n';
        }.bind(this));
      }
    } else {
      if (this[x] !== undefined) {
        if (moreThanOne[x]) {
          this[x].forEach(function (y) {
            sdp += x + '=' + y + '\n';
          }.bind(this));
        } else {
          sdp += x + '=' + this[x] + '\n';
        }
      }
    }
  }.bind(this));
  this.m.forEach(function (x) {
    mediaOrder.forEach(function (y) {
      if (y === 'a' && x[y] !== undefined) {
        for ( var z in x.a) {
          x.a[z].forEach(function (w) {
            sdp += 'a=' + z + ((w.length > 0) ? ':' : '') + w + '\n';
          });
        }
      } else {
        if (x[y] !== undefined) {
          if (moreThanOne[y]) {
            x[y].forEach(function (z) {
              sdp += y + '=' + z + '\n';
            });
          } else {
            sdp += y + '=' + x[y] + '\n';
          }
        }
      }
    });
  });
  return sdp;
}

module.exports = SDP;
