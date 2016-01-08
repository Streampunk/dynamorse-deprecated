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
varå Grain = require('../model/Grain.js');
var H = require('highland');

var defaultExtMap = {
  'urn:x-ipstudio:rtp-hdrext:origin-timestamp' : 1,
  'urn:ietf:params:rtp-hdrext:smpte-tc' : 2,
  'urn:x-ipstudio:rtp-hdrext:flow-id' : 3,
  'urn:x-ipstudio:rtp-hdrext:source-id' : 4,
  'urn:x-ipstudio:rtp-hdrext:grain-flags' : 5,
  'urn:x-ipstudio:rtp-hdrext:sync-timestamp' : 7,
  'urn:x-ipstudio:rtp-hdrext:grain-duration' : 9
};

function makeLookup (sdp) {
  var revMap = (SDP.isSDP()) ? sdp.getExtMapReverse(0) : defaultExtMap;
  revMap = (revMap) ? revMap : defaultExtMap;

  var lookup = {};
  Object.keys(revMap).each(function (x) {
    var m = x.trim().match(/.*:([^\s]+)$/);
    if (m) {
      lookup[m[1].replace(/-/g, '_')] = 'id' + revMap[x];
    }
  });
  return lookup;
}

module.exports = function (sdp, seq) {
  if (!seqStart) seq = Math.floor(Math.random() * 0xffffffff);
  var payloadType = (SDP.isSDP(sdp)) ? sdp.getPayloadType(0) : 0;
  var rtpTsOffset = (SDP.isSDP(sdp)) ? sdp.getClockOffset(0) : 0;
  var is4175 = (SDP.isSDP(sdp)) ? (sdp.getEncodingName(0) === 'raw') : false;
  var clockRate = (SDP.isSDP(sdp)) ? sdp.getClockRate() : 48000;
  var stride = (SDP.isSDP(sdp)) ? sdp.getStride(0) : 1;
  var lookup = makeLookup(sdp);
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
          is4175 = (sdp.getEncodingName(0) === 'raw');
          clockRate = x.getClockRate(0)
          stride = x.getStride(0);
          lookup = makeLookup(x);
        } else {
          push(new Error('Received payload before SDP file. Discarding.'));
        }
      } else if (Grain.isGrain(x)) {
        if (initState) {
          push(null, sdp);
          initState = false;
        }
        function makePacket() {
          var packet = (is4175) ? new RFC4175Packet(new Buffer(1452)) :
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
        var startExt = { profile : 0xbede };
        startExt[lookup.grain_flags] = 0x80;
        startExt[lookup.origin_timestamp] = x.ptpOrigin;
        startExt[lookup.sync_timestamp] = x.ptpSync;
        startExt[lookup.grain_duration] = x.duration;
        startExt[lookup.flow_id] = x.flow_id;
        startExt[lookup.source_id] = s.source_id;
        startExt[lookup.smpte_id] = s.timecode;
        packet.setExtension(startExt);

        var remaining = 1452 - 12 - 80;
        var i = 0, o = 0;
        var b = x.buffers[i];
        while (i < x.buffers.length) {
          if (is4175) {
            // TODO
          } else {
            var t = remaining - remaining % stride;
            if ((b.length - o) >= t) {
              packet.setPayload(b.slice(o, o + t));
              o += t;
              push(null, packet);
              tsAdjust = t / stride;
              packet = makePacket();
              remaining = 1432; // Slightly short so last header fits
            } else if (++i < x.buffers.length) {
              b = Buffer.concat([b.slice(o), x.buffers[i]],
                b.length + x.buffers[i].length - o);
              o = 0;
            } else {
              b = b.slice(o);
            }
          }
        }
        var endExt = { profile : 0xbede };
        endExt[lookup.grain_flags] = 0x40;
        packet.setExtensions(endExt);
        packet.setPayload(b);
        push(null, packet);
      }
      next();
    }
  };
  return H.pipeline(H.consume(grainMuncher));
}
