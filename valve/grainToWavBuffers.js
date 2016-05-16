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

var H = require('highland');
var SDP = require('../model/SDP.js');

module.exports = function (sdp) {
  var initState = true;
  var length = 0;
  var running = true;
  var bitsPerSample = 16;
  var wavWatch = function (err, x, push, next) {
    if (err) {
      push(err),
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
      running = false;
    } else {
      if (sdp === undefined) {
          if (SDP.isSDP(x)) {
          sdp = x;
        } else {
          push(new Error('Grain received before SDP will be discarded.'));
        }
      } else {
        if (initState) {
          if (!SDP.isSDP(sdp)) {
            push(new Error('SDP data is not as expected. Terminating.'));
            push(null, H.nil);
            running = false;
          } else if (sdp.getMedia(0) !== 'audio') {
            push(new Error('Cannot create WAVE header for non-audio data.'));
            push(null, H.nil);
            running = false;
          } else {
            var h = new Buffer(44);
            h.writeUInt32BE(0x52494646, 0); // RIFF
            h.writeUInt32LE(0xffffffff, 4); // Dummy length to be replaced
            h.writeUInt32BE(0x57415645, 8); // WAVE
            h.writeUInt32BE(0x666d7420, 12); // fmt
            h.writeUInt32LE(16, 16); // Subchunk size
            h.writeUInt16LE(1, 20); // PCM Format
            var channels = +sdp.getEncodingParameters(0);
            h.writeUInt16LE(channels, 22); // No of channels
            var sampleRate = sdp.getClockRate(0);
            h.writeUInt32LE(sampleRate, 24); // sample rate
            bitsPerSample = +sdp.getEncodingName(0).substring(1);
            h.writeUInt32LE(Math.ceil(sampleRate * channels * (bitsPerSample / 8)), 28); // byte rate
            h.writeUInt16LE(Math.ceil(channels * (bitsPerSample / 8)), 32); // block align
            h.writeUInt16LE(bitsPerSample, 34); // Bits per sampls
            h.writeUInt32BE(0x64617461, 36); // data
            h.writeUInt32LE(0xffffffff, 40); // sub-chunk size ... to be fixed
            push(null, h);
            // TODO this probably won't work with 12 or 20 bit audio
          }
          initState = false;
        }
        if (Array.isArray(x.buffers)) {
          x.buffers.forEach(function (x) {
            switch (bitsPerSample) {
              case 24:
                var tmp = 0|0;
                for ( var y = 0|0 ; y < x.length ; y += 3|0 ) {
                  tmp = x[y];
                  x[y] = x[y + 2];
                  x[y + 2] = tmp;
                }
                break;
              case 16:
                var tmp = 0|0;
                for ( var y = 0|0 ; y < x.length ; y += 2|0 ) {
                  tmp = x[y];
                  x[y] = x[y + 1];
                  x[y + 1] = tmp;
                }
                break;
              default: // No swap
                break;
            }
            push(null, x);
          });
        }
      }
      if (running) { next(); }
    }
  }
  return H.pipeline(H.consume(wavWatch));
}
