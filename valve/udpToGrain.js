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
var Grain = require('../model/Grain.js');
var RTPPacket = require('../model/RTPPacket.js')
var RFC4175Packet = require('../model/RFC4175Packet.js')

// exts is an object with the index properties origin_timestamp_id, flow_id_id etc.
// defined
module.exports = function (exts, pgroup) {
  var RTP = pgroup ? RFC4175Packet : RTPPacket;
  var pushLines = pgroup;
  var rtpCounter = -2;
  var origin_timestamp, smpte_tc, flow_id, source_id,
    grain_flags, sync_timestamp, grain_duration;
  var payloads = [];
  var ex = exts;
  var udpConsumer = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else { // exts are available
      if (Buffer.isBuffer(x)) {
        var rtp = new RTP(x);
        var nextCounter = (pushLines) ? rtp.getCompleteSequenceNumber() :
          rtp.getSequenceNumber();
        if (rtpCounter !== -2) {
          if (nextCounter === 0 && rtpCounter != (pushLines ? 0xffffffff : 0xffff)) {
            push(new Error('Unexpected sequence number at wrap around.'));
          } else {
            if ((rtpCounter + 1) !== nextCounter) {
              if (pushLines && (nextCounter & 0xffff === 0xffff)) {
                // TODO remove this line when BBC bug is fixed
                push(new Error('Detected BBC wrap around bug.'));
                nextCounter = (rtpCounter & 0xffff0000) | 0xffff
              } else {
                push(new Error('RTP sequence discontinuity. Expected ' +
                  (rtpCounter + 1) + ', got ' + nextCounter + '.'));
              }
            }
          }
        }
        rtpCounter = nextCounter;
        if (rtp.isStart()) {
          payloads = (pushLines) ? rtp.getLineData().map(function (x) {
            return x.data }) : [ rtp.getPayload() ];
          var rtpex = rtp.getExtensions();
          origin_timestamp = rtpex['NMOS-PTPOrigin'];
          sync_timestamp = rtpex['NMOS-PTPSync'];
          grain_duration = rtpex['NMOS-GrainDuration'];
          smpte_tc = rtpex['NMOS-Timecode'];
          flow_id = rtpex['NMOS-FlowID'];
          source_id = rtpex['NMOS-SourceID'];
        } else if (rtp.isEnd())  {
          if (pushLines) {
            rtp.getLineData().forEach(function (x) { payloads.push(x.data); })
          } else {
            payloads.push(rtp.getPayload());
          }
          push(null, new Grain(payloads, sync_timestamp, origin_timestamp,
            smpte_tc, flow_id, source_id, grain_duration));
        } else {
          if (pushLines) {
            rtp.getLineData().forEach(function (x) { payloads.push(x.data); })
          } else {
            payloads.push(rtp.getPayload());
          }
        }
      } else {
        console.log(x);
        // push(new Error('Unknown data type pushed through udp-to-grain.'));
      }
      next();
    }
  };
  return H.pipeline(
    H.consume(udpConsumer),
    H.errors(function (err, push) { console.error('udpToGrain: ' + err); }));
}
