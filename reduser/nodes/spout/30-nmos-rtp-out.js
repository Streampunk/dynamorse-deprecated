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

var redioactive = require('../../../util/Redioactive.js');
var util = require('util');
var RFC4175Packet = require('../../../model/RFC4175Packet.js');
var RTPPacket = require('../../../model/RTPPacket.js');
var Grain = require('../../../model/Grain.js');
var dgram = require('dgram');

// TODO add IPv6 support

var fieldMap = {
  '576i'  : { field1Start : 23, field1End : 310, field2Start : 336, field2End : 623 },
  '720p'  : { field1Start : 26, field1End : 745 },
  '1080i' : { field1Start : 21, field1End : 560, field2Start : 584, field2End : 1123 },
  '1080p' : { field1Start : 42, field1End : 1121 },
  '2160p' : { field1Start : 0, field1End : 2159 },
  '4320p' : { field1Start : 0, field1End : 4319 }
};

function getStride (tags) {
  if (tags.encodingName[0] === 'raw') {
    var depth = +tags.depth[0];
    var spp = (tags.sampling[0].indexOf('4:4:4') >= 0) ? 3 :
       ((tags.sampling[0].indexOf('4:2:2') >= 0) ? 2 : 1.5);
    switch (depth) {
       case 8: return Math.ceil(spp);
       case 10: return 5;
       case 16: return spp * 2;
    }
  } else if (tags.format[0] === 'audio') {
    if (tags.blockAlign) return +tags.blockAlign[0];
    return +tags.channels[0] * +tags.encodingName[0].substring(1);
  } else {
    return 1;
  }
}

function getByteFactor (tags) {
  var depth = +tags.depth[0];
  var width = +tags.width[0];
  var spp = (tags.sampling[0].indexOf('4:4:4') >= 0) ? 3 :
     ((tags.sampling[0].indexOf('4:2:2') >= 0) ? 2 : 1.5);
  return spp * depth / 8;
}

module.exports = function (RED) {
  function NMOSRTPOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    var seq = (Math.random() * 0xffffffff) >>> 0;
    var payloadType = 96;
    var rtpTsOffset = (Math.random() * 0xffffffff) >>> 0;
    var is4175 = false;
    var width = undefined;
    var height = undefined;
    var byteFactor = undefined;
    var interlace = false;
    var clockRate = 48000;
    var stride = 1;
    var syncSourceID = (Math.random() * 0xffffffff) >>> 0;
    var initState = true;
    var tsAdjust = 0; // Per packet timestamp adjustment - for samples / fields
    var lineStatus = null;
    var is4175 = false;
    this.srcFlow = null;
    var node = this;
    // Set up connection
    var sock = dgram.createSocket({type  :'udp4', reuseAddr : true});
    sock.bind(config.port, function (err) {
      if (err) return node.warn(err);
      console.log('Binding bounded.');
      sock.setMulticastTTL(config.ttl);
    });
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var rtpExtDefID = this.context().global.get('rtp_ext_id');
    var rtpExts = RED.nodes.getNode(rtpExtDefID).getConfig();
    this.each(function (g, next) {
      if (!Grain.isGrain(g)) return node.warn('Received a non-grain on the input.');
      if (!this.tags) {
        this.getNMOSFlow(g, function (err, f) {
          if (err) return push("Failed to resolve NMOS flow.");
          this.srcFlow = f;
          this.tags = f.tags;
          clockRate = +f.tags.clockRate[0];
          is4175 = f.tags.encodingName[0] === 'raw'; // TODO add pgroup/V210 check
          if (is4175) {
            width = +f.tags.width[0];
            height = +f.tags.height[0];
            byteFactor = getByteFactor(f.tags);
            interlace = f.tags.interlace && f.tags.interlace[0] === '1';
          }
          stride = getStride(f.tags);
          pushGrain(g, next);
        }.bind(this));
      } else {
        pushGrain(g, next);
      }
    }.bind(this));
    function pushGrain (g, next) {
      console.log('***', height + ((interlace) ? 'i' : 'p'), interlace);
      lineStatus = (is4175) ? {
        width: width, stride: stride, lineNo: 21,
        bytesPerLine: width * byteFactor, byteFactor: byteFactor, linePos: 0,
        fieldBreaks: fieldMap[height + ((interlace) ? 'i' : 'p')],
        field : 1
      } : undefined;
      var remaining = 1200; // Allow for extension
      var packet = makePacket(g, remaining);

      // Make grain start RTP header extension
      var startExt = { profile : 0xbede };
      startExt['id' + rtpExts.grain_flags_id] = new Buffer([0x80]);
      startExt['id' + rtpExts.origin_timestamp_id] = g.ptpOrigin;
      startExt['id' + rtpExts.sync_timestamp_id] = g.ptpSync;
      startExt['id' + rtpExts.grain_duration_id] = g.duration;
      startExt['id' + rtpExts.flow_id_id] = g.flow_id;
      startExt['id' + rtpExts.source_id_id] = g.source_id;
      startExt['id' + rtpExts.smpte_tc_id] = g.timecode;
      var actualExts = packet.setExtensions(startExt);
      if (actualExts.prototype && actualExts.prototype.name === 'Error')
        node.warn(`Failed to set header extensions: ${actualExts}`);

      var sumt = 0;

      var i = 0, o = 0;
      var b = g.buffers[i];
      while (i < g.buffers.length) {
        var t = (!is4175 || !packet.getMarker()) ? remaining - remaining % stride :
          packet.getLineData()[0].length;
        // console.log('HAT', packet.getLineData()[0].lineNo, (b.length - o) % 4800, 4800 - lineStatus.linePos,
        //   ((b.length - o) % 4800) - (4800 - lineStatus.linePos));
        if ((b.length - o) >= t) {
          packet.setPayload(b.slice(o, o + t));
          o += t;
          sendPacket(packet, remaining); // May want to spread packets
          // FIXME: probably won't work for compressed video
          if (!is4175) tsAdjust += t / stride;
          remaining = 1410; // Slightly short so last header fits
          packet = makePacket(g, remaining);
        } else if (++i < g.buffers.length) {
          b = Buffer.concat([b.slice(o), g.buffers[i]],
            b.length + g.buffers[i].length - o);
          o = 0;
        } else {
          b = b.slice(o);
        }
      }
      var endExt = { profile : 0xbede };
      endExt['id' + rtpExts.grain_flags_id] = new Buffer([0x40]);
      // console.log('B4', packet.getLineData());
      packet.setExtensions(endExt);
      packet.setMarker(true);
      packet.setPayload(b);
      // console.log('ARF', packet.getLineData());

      console.log('!!!! Last one!');
      sendPacket(packet, remaining);
      if (config.timeout === 0) setImmediate(next);
      else setTimeout(next, config.timeout);
    }

    function makePacket (g, remaining) {
      var packet = (is4175) ? new RFC4175Packet(new Buffer(1452)) :
        new RTPPacket(new Buffer(1452));
      packet.setVersion(2);
      packet.setPadding(false);
      packet.setExtension(false);
      packet.setCSRCCount(0);
      packet.setMarker(false);
      packet.setPayloadType(payloadType);
      packet.setSequenceNumber(seq & 65535);
      if (is4175) packet.setExtendedSequenceNumber(seq >>> 16);
      seq = (seq <= 0xffffffff) ? seq + 1 : 0;
      // Special shift >>> 0 is a cheat to get a UInt32
      // Not updating audio timestamps as per pcaps
      packet.setTimestamp((g.originAtRate(clockRate) + rtpTsOffset + tsAdjust) >>> 0);
      packet.setSyncSourceID(syncSourceID);
      if (is4175) {
        lineStatus = packet.setLineDataHeaders(lineStatus, remaining);
        // console.log(lineStatus);
        if (lineStatus.field == 2) {
          tsAdjust = 1800; // TODO Find a frame rate adjust
        }
      }
      return packet;
    }

    function sendPacket (p) {
      sock.send(p.buffer, 0, p.buffer.length, config.port, config.address);
      console.log(JSON.stringify(p, null, 2));
    }
    this.errors(function (e, next) {
      this.warn(`Received unhandled error: ${e.message}.`);
      if (config.timeout === 0) setImmediate(next);
      else setTimeout(next, config.timeout);
    }.bind(this));
    this.done(function () {
      this.log('Stream has all dried up!');
      if (sock) sock.close();
    }.bind(this));
  }
  util.inherits(NMOSRTPOut, redioactive.Spout);
  RED.nodes.registerType("nmos-rtp-out", NMOSRTPOut);
}
