/* Copyright 2016 Christine S. MacNeill

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
var util = require('util');
var url = require('url');
var http = require('http');

var srcBytesPerPixelPair = 5; // !!! rfc4175 pgroup !!!

module.exports = function (RED) {
  function PCAPReader (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);
    fs.access(config.file, fs.R_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    this.tags = {};
    this.sdpURLReader(config, function (err, data) {
      if (err) {
        return this.preFlightError(err);
      }
      this.highland(
        pcapInlet(config.file, config.loop)
        .pipe(udpToGrain(this.tags))
        .pipe(grainConcater(+this.tags.width[0] * +this.tags.height[0] * srcBytesPerPixelPair / 2)));
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(PCAPReader, redioactive.Funnel);
  RED.nodes.registerType("pcap-reader", PCAPReader);

  PCAPReader.prototype.sdpToTags = function(sdp, config) {
    if (typeof sdp === 'string') {
      sdp = new SDP(sdp);
    }
    this.setTag('format', sdp, sdp.getMedia, config, 'urn:x-nmos:format:');
    this.setTag('encodingName', sdp, sdp.getEncodingName, config);
    this.setTag('clockRate', sdp, sdp.getClockRate, config);
    if (this.tags.format[0].endsWith('video')) {
      this.setTag('height', sdp, sdp.getHeight, config);
      this.setTag('width', sdp, sdp.getWidth, config);
      this.setTag('sampling', sdp, sdp.getSampling, config);
      this.setTag('depth', sdp, sdp.getDepth, config);
      this.setTag('colorimetry', sdp, sdp.getColorimetry, config);
      this.setTag('interlace', sdp, sdp.getInterlace, config);
      this.tags.packging = 'pgroup';
    } else if (this.tags.format[0].endsWith('audio')) {
      this.setTag('channels', sdp, sdp.getEncodingParameters, config);
    }
    console.log(this.tags);
    return this.tags;
  }

  PCAPReader.prototype.setTag = function (name, sdp, valueFn, config, prepend) {
    if (!name) return;
    var value = (valueFn) ? valueFn.call(sdp, 0) : undefined;
    if (!value) {
      value = config[name];
      if (!value) {
        this.warn(`Did not set property ${name} as it is not defined by SDP or config.`);
        return;
      }
      if (prepend && typeof present === 'string') value = prepend + value;
    } else if (prepend && typeof present === 'string') {
      value = prepend + value;
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

  PCAPReader.prototype.testAccess = function (config) {
    setTimeout(() => { console.log('+=+', config, this.tags); }, 1000);
  }
}
