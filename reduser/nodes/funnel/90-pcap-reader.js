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

var util = require('util');
var fs = require('fs');
var redioactive = require('../../../util/Redioactive.js');
var H = require('highland');
var pcapInlet = require('../../../funnel/pcapInlet.js');
var udpToGrain = require('../../../valve/udpToGrain.js');
var grainConcater = require('../../../valve/grainConcater.js');
var SDP = require('../../../model/SDP.js');
var Grain = require('../../../model/Grain.js');
var util = require('util');
var url = require('url');
var http = require('http');

module.exports = function (RED) {
  function PCAPReader (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);
    // Do not run unless global config has been established
    if (!this.context().global.get('updated')) {
      this.log('False start for PCAP reader funnel.');
      return;
    }
    fs.access(config.file, fs.R_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    var node = this;
    this.tags = {};
    console.log(config);
    this.grainCount = 0;
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ]
    this.exts = RED.nodes.getNode(
      this.context().global.get('rtp_ext_id')).getConfig();
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    this.sdpURLReader(config, function (err, data) {
      if (err) {
        return this.preFlightError(err);
      }
      var localName = config.name || `${config.type}-${config.id}`;
      var localDescription = config.description || `${config.type}-${config.id}`;
      var pipelinesID = config.device ?
        RED.nodes.getNode(config.device).nmos_id :
        this.context().global.get(pipelinesID);
      var source = new ledger.Source(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], null, null, pipelinesID, null);
      var flow = new ledger.Flow(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], this.tags, source.id, null);
      nodeAPI.putResource(source, function(err, result) {
        if (err) return node.log(`Unable to register source: ${err}`);
      });
      nodeAPI.putResource(flow).then(function () {
        this.highland(
          pcapInlet(config.file, config.loop)
          .pipe(udpToGrain(this.exts, this.tags.format[0].endsWith('video')))
          .map(function (g) {
            if (!config.regenerate) {
              return new Grain(g.buffers, g.ptpSync, g.ptpOrigin, g.timecode,
                flow.id, source.id, g.duration);
            }
            var grainTime = new Buffer(10);
            grainTime.writeUIntBE(this.baseTime[0], 0, 6);
            grainTime.writeUInt32BE(this.baseTime[1], 6);
            var grainDuration = g.getDuration();
            this.baseTime[1] = ( this.baseTime[1] +
              grainDuration[0] * 1000000000 / grainDuration[1]|0 );
            this.baseTime = [ this.baseTime[0] + this.baseTime[1] / 1000000000|0,
              this.baseTime[1] % 1000000000];
            return new Grain(g.buffers, grainTime, g.ptpOrigin, g.timecode,
              flow.id, source.id, g.duration);
          }.bind(this))
          .pipe(grainConcater(this.tags)));
      }.bind(this), function(err, result) {
        if (err) return node.log(`Unable to register flow: ${err}`);
      });
    }.bind(this));
    this.on('close', this.close); // Delete flows when we're done?
  }
  util.inherits(PCAPReader, redioactive.Funnel);
  RED.nodes.registerType("pcap-reader", PCAPReader);

  PCAPReader.prototype.sdpToTags = function(sdp, config) {
    if (typeof sdp === 'string') {
      sdp = new SDP(sdp);
    }
    this.setTag('format', sdp, sdp.getMedia, config);
    this.setTag('encodingName', sdp, sdp.getEncodingName, config);
    this.setTag('clockRate', sdp, sdp.getClockRate, config);
    if (this.tags.format[0].endsWith('video')) {
      this.setTag('height', sdp, sdp.getHeight, config);
      this.setTag('width', sdp, sdp.getWidth, config);
      this.setTag('sampling', sdp, sdp.getSampling, config);
      this.setTag('depth', sdp, sdp.getDepth, config);
      this.setTag('colorimetry', sdp, sdp.getColorimetry, config);
      this.setTag('interlace', sdp, sdp.getInterlace, config);
      this.tags.packing = [ 'pgroup' ];
    } else if (this.tags.format[0].endsWith('audio')) {
      this.setTag('channels', sdp, sdp.getEncodingParameters, config);
    }
    // console.log(this.tags);
    this.sdpToExt(sdp);
    return this.tags;
  }

  PCAPReader.prototype.setTag = function (name, sdp, valueFn, config) {
    if (!name) return;
    var value = (valueFn) ? valueFn.call(sdp, 0) : undefined;
    if (!value) {
      value = config[name];
      if (!value) {
        this.warn(`Did not set property ${name} as it is not defined by SDP or config.`);
        return;
      }
    }
    if (typeof value === 'number') {
      this.tags[name] = [ `${value}` ];
    } else if (typeof value === 'string') {
      this.tags[name] = [ value ];
    } else if (typeof value === 'boolean') {
      this.tags[name] = [ `${value}` ];
    } else {
      this.warn(`Cannot set property ${name} because value is of unsupported type ${typeof value}.`);
    }
  }

  PCAPReader.prototype.sdpURLReader = function (config, cb) {
    var sdpUrl = config.sdpURL;
    if (!sdpUrl || typeof sdpUrl !== 'string' || sdpUrl.length === 0)
      return cb(null, this.sdpToTags({}, config));
    var sdpDetails = url.parse(sdpUrl);
    if (sdpDetails.protocol.startsWith('file')) {
      return fs.readFile(sdpDetails.path, 'utf8', function (err, data) {
        if (err) return cb(err);
        else return cb(null, this.sdpToTags(data, config));
      }.bind(this));
    } else if (sdpDetails.protocol.startsWith('http:')) {
      http.get(sdpDetails.href, function (res) {
        if (res.statusCode !== 200) return cb(new Error(
          'SDP file request resulted in non-200 response code.'));
        res.setEncoding('utf8');
        res.on('data', function (data) {
          cb(null, this.sdpToTags(data, config));
        });
      }.bind(this));
    } else {
      cb(new Error('Cannot read an SDP file with protocols other than http or file.'));
    }
  }

  PCAPReader.prototype.sdpToExt = function (sdp) {
    if (!SDP.isSDP(sdp)) return;
    var revExtMap = sdp.getExtMapReverse(0);
    this.exts.origin_timestamp_id = revExtMap['urn:x-nmos:rtp-hdrext:origin-timestamp'];
    this.exts.smpte_tc_id = revExtMap['urn:ietf:params:rtp-hdrext:smpte-tc'];
    this.exts.flow_id_id = revExtMap['urn:x-nmos:rtp-hdrext:flow-id'];
    this.exts.source_id_id = revExtMap['urn:x-nmos:rtp-hdrext:source-id'];
    this.exts.grain_flags_id = revExtMap['urn:x-nmos:rtp-hdrext:grain-flags'];
    this.exts.sync_timestamp_id = revExtMap['urn:x-nmos:rtp-hdrext:sync-timestamp'];
    this.exts.grain_duration_id = revExtMap['urn:x-nmos:rtp-hdrext:grain-duration'];
    this.exts.ts_refclk = sdp.getTimestampReferenceClock(0);
    this.exts.smpte_tc_param = sdp.getSMPTETimecodeParameters(0);
    return this.exts;
  }

  PCAPReader.prototype.testAccess = function (config) {
    setTimeout(() => { console.log('+=+', config, this.tags); }, 1000);
  }
}
