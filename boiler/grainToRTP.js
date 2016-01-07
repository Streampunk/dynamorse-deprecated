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

var RTPPacket = require('../model/RTPPacket.js');
var RFC4175Packet = require('../model/RFC4175Packet.js');
var SDP = require('../model/SDP.js');
var Grain = require('../model/Grain.js');
var H = require('highland');

module.exports = function (sdp, seq) {
  if (!seqStart) seq = Math.floor(Math.random() * 0xffffffff);
  var payloadType = (SDP.isSDP(sdp)) ? sdp.getPayloadType(0) : 0;
  var rtpTsOffset = (SDP.isSDP(sdp)) ? sdp.getClockOffset(0) : 0;
  var isVideo = (SDP.isSDP(sdp)) ? (sdp.getMedia() === 'video') : false;
  var clockRate = (SDP.isSDP(sdp)) ? sdp.getClockRate() : 48000;
  var syncSourceID = Math.floor(Math.random() * 0xffffffff);
  var initState = true;
  var tsAdjust = 0; // Per packet timestamp adjustment - for samples / fields
  var grainMuncher = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      if (sdp == undefined) {
        if (SDP.isSDP(x)) {
          sdp = x;
          payloadType = sdp.getPayloadType(0);
          rtpTsOffset = sdp.getClockOffset(0);
          isVideo = (sdp.getMedia() === 'video');
        }
      } else if (Grain.isGrain(x)) {
        if (initState) {
          push(null, sdp);
          initState = false;
        }
        function makePacket() {
          var packet = (isVideo) ? new RFC4175Packet(new Buffer(1452)) :
            new RTPPacket(new Buffer(1452));
          packet.setVersion(2);
          packet.setPadding(false);
          packet.setExtension(false);
          packet.setCSRCCount(0);
          packet.setMarker(false);
          packet.setPayloadType(payloadType);
          packet.setSequenceNumber(seq & 65535);
          seq = (seq <= 0xffffffff) ? seq + 1 : 0;
          // Special shift >>> 0 is a cheat to get a UInt32
          // Not updating audio timestamps as per pcaps
          packet.setTimestamp((x.originAtRate(clockRate) + rtpTsOffset + tsAdjust) >>> 0);
          packet.setSyncSourceID(syncSourceID);
          return packet;
        }

        var packet = makePacket();
        // Add start header extensions
        var remaining = 1452 - 12 - 80;
        packet.setExtension(true);
        for ( var i = 0 ; i < x.buffers.length ; x++ ) {


        }
        // Add end header extensions and mark for video
      }
      next();
    }
  };
  return H.pipeline(H.consume(grainMuncher));
}
