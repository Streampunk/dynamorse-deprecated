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

var H = require('highland');
var Grain = require('../model/Grain.js');
var SDP = require('../model/SDP.js');
var RTPPacket = require('../model/RTPPacket.js')
var RFC4175Packet = require('../model/RFC4175Packet.js')

module.exports = function(sdp) {
  var RTP = RTPPacket;
  var pushLines = false;
  setSDP(sdp);
  var rtpCounter = -2;
  var origin_timestamp, smpte_tc, flow_id, source_id,
    grain_flags, sync_timestamp, grain_duration;
  var origin_timestamp_id, smpte_tc_id, flow_id_id, source_id_id,
    grain_flags_id, sync_timestamp_id, grain_duration_id;
  var initState = true;
  function setSDP(s) {
    if (!SDP.isSDP(s)) {
      sdp = undefined; revExtMap = undefined; RTP = RTPPacket;
    } else {
      sdp = s;
      var revExtMap = s.getExtMapReverse(0);
      origin_timestamp_id = revExtMap['urn:x-ipstudio:rtp-hdrext:origin-timestamp'];
      smpte_tc_id = revExtMap['urn:ietf:params:rtp-hdrext:smpte-tc'];
      flow_id_id = revExtMap['urn:x-ipstudio:rtp-hdrext:flow-id'];
      source_id_id = revExtMap['urn:x-ipstudio:rtp-hdrext:source-id'];
      grain_flags_id = revExtMap['urn:x-ipstudio:rtp-hdrext:grain-flags'];
      sync_timestamp_id = revExtMap['urn:x-ipstudio:rtp-hdrext:sync-timestamp'];
      grain_duration_id = revExtMap['urn:x-ipstudio:rtp-hdrext:grain-duration'];
      if (s.getEncodingName(0) === 'raw') {
        RTP = RFC4175Packet; pushLines = true;
      } else {
        RTP = RTPPacket; pushLines = false;
      }
    }
  }
  var payloads = [];
  var udpConsumer = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      if (sdp === undefined) {
        if (SDP.isSDP(x)) {
          setSDP(x);
          push(null, x);
        } else {
          push(new Error('Cannot create Grain or work out start without SDP data first.'));
        }
      } else { // sdp is available
        if (Buffer.isBuffer(x)) {
          var rtp = new RTP(x);
          var nextCounter = (pushLines) ? rtp.getCompleteSequenceNumber() :
            rtp.getSequenceNumber();
	  // console.log(pushLines, nextCounter);
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
          if (initState) {
            if (rtp.isStart(grain_flags_id)) {
              initState = false;
              push(null, sdp);
            }
          }
          if (!initState) {
            if (rtp.isStart(grain_flags_id)) {
              payloads = (pushLines) ? rtp.getLineData().map(function (x) {
                return x.data }) : [ rtp.getPayload() ];
              var exts = rtp.getExtensions();
              origin_timestamp = exts['id' + origin_timestamp_id];
              sync_timestamp = exts['id' + sync_timestamp_id];
              grain_duration = exts['id' + grain_duration_id];
              smpte_tc = exts['id' + smpte_tc_id];
              flow_id = exts['id' + flow_id_id];
              source_id = exts['id' + source_id_id];
            } else if (rtp.isEnd(grain_flags_id)) {
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
          }
        } else {
          console.log(x);
          // push(new Error('Unknown data type pushed through udp-to-grain.'));
        }
      } // elsr => (sdp !== undefined)
      next();
    }
  }
  return H.pipeline(H.consume(udpConsumer));
}
