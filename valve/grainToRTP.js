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

var RTPPacket = require('../model/RTPPacket.js');
var RFC4175Packet = require('../model/RFC4175Packet.js');
var SDP = require('../model/SDP.js');
var Grain = require('../model/Grain.js');
var H = require('highland');

var defaultExtMap = {
  'urn:x-nmos:rtp-hdrext:origin-timestamp' : 1,
  'urn:ietf:params:rtp-hdrext:smpte-tc' : 2,
  'urn:x-nmos:rtp-hdrext:flow-id' : 3,
  'urn:x-nmos:rtp-hdrext:source-id' : 4,
  'urn:x-nmos:rtp-hdrext:grain-flags' : 5,
  'urn:x-nmos:rtp-hdrext:sync-timestamp' : 7,
  'urn:x-nmos:rtp-hdrext:grain-duration' : 9
};

var fieldMap = {
  '576i'  : { field1Start : 23, field1End : 310, field2Start : 336, field2End : 623 },
  '720p'  : { field1Start : 26, field1End : 745 },
  '1080i' : { field1Start : 21, field1End : 560, field2Start : 584, field2End : 1123 },
  '1080p' : { field1Start : 42, field1End : 1121 },
  '2160p' : { field1Start : 0, field1End : 2159 },
  '4320p' : { field1Start : 0, field1End : 4319 }
}

function makeLookup (sdp) {
  var revMap = (SDP.isSDP()) ? sdp.getExtMapReverse(0) : defaultExtMap;
  revMap = (revMap) ? revMap : defaultExtMap;

  var lookup = {};
  Object.keys(revMap).forEach(function (x) {
    var m = x.trim().match(/.*:([^\s]+)$/);
    if (m) {
      lookup[m[1].replace(/-/g, '_')] = 'id' + revMap[x];
    }
  });
  return lookup;
}

module.exports = function (sdp, seq) {
  if (!seq) seq = Math.floor(Math.random() * 0xffffffff);
  var payloadType = (SDP.isSDP(sdp)) ? sdp.getPayloadType(0) : 0;
  var rtpTsOffset = (SDP.isSDP(sdp)) ? sdp.getClockOffset(0) : 0;
  var is4175 = (SDP.isSDP(sdp)) ? (sdp.getEncodingName(0) === 'raw') : false;
  var width = (SDP.isSDP(sdp)) ? sdp.getWidth(0) : undefined;
  var clockRate = (SDP.isSDP(sdp)) ? sdp.getClockRate(0) : 48000;
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
          width = sdp.getWidth(0);
          clockRate = sdp.getClockRate(0)
          stride = sdp.getStride(0);
          lookup = makeLookup(x);
        } else {
          push(new Error('Received payload before SDP file. Discarding.'));
        }
      } else if (Grain.isGrain(x)) {
        if (initState) {
          push(null, sdp);
          initState = false;
        }
        var lineStatus = (is4175) ? {
          width: width, stride: stride, lineNo: 21,
          bytesPerLine: width * stride, linePos: 0,
          fieldBreaks: fieldMap[height + 'i'], field : 1 // TODO determine i vs p
        } : undefined;
        function makePacket (g) {
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
          if (is4175) {
            lineStatus = packet.setLineData(lineStatus);
            if (lineStatus.field == 2) {
              tsAdjust = 1800; // TODO Find a frame rate adjust
            }
          }
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
        startExt[lookup.source_id] = x.source_id;
        startExt[lookup.smpte_id] = x.timecode;
        packet.setExtension(startExt);

        var remaining = 1200;
        var i = 0, o = 0;
        var b = x.buffers[i];
        while (i < x.buffers.length) {
          var t = remaining - remaining % stride;
          if ((b.length - o) >= t) {
            packet.setPayload(b.slice(o, o + t));
            o += t;
            push(null, packet);
            // FIXME: probably won't work for compressed video
            if (!is4175) tsAdjust += t / stride;
            packet = makePacket();
            remaining = 1410; // Slightly short so last header fits
          } else if (++i < x.buffers.length) {
            b = Buffer.concat([b.slice(o), x.buffers[i]],
              b.length + x.buffers[i].length - o);
            o = 0;
          } else {
            b = b.slice(o);
          }
        }
        var endExt = { profile : 0xbede };
        endExt[lookup.grain_flags] = 0x40;
        packet.setExtensions(endExt);
        if (is4175) {
          packet.setMarker(true);
          // TODO
        } else {
          packet.setPayload(b);
        }
        push(null, packet);
      }
      next();
    }
  };
  return H.pipeline(H.consume(grainMuncher));
}
