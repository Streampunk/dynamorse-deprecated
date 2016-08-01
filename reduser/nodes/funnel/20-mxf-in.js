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
var klv = require('kelvinadon');
var Promise = require('promise');
var fs = require('fs');
var url = require('url');
var H = require('highland');
var uuid = require('uuid');
var Grain = require('../../../model/Grain.js');
var Timecode = require('../../../model/Timecode.js');

var fsaccess = Promise.denodeify(fs.access);
function makeTags(x) {
  if (!x.description) return {};
  switch (x.description.ObjectClass) {
    case 'MPEGVideoDescriptor':
      var tags = { descriptor : [ 'MPEGVideoDescriptor' ] };
      tags.width = [ `${x.description.StoredWidth}` ];
      tags.height = [ `${(x.description.FrameLayout === 'SeparateFields') ?
        2 * x.description.StoredHeight : x.description.StoredHeight}` ];
      tags.depth = [ `${x.description.ComponentDepth}` ];
      tags.format = [ 'video' ];
      tags.encodingName = [ 'H264' ]; // TODO fix up ... could be MPEG-2 video?
      if (!x.description.VerticalSubsampling) x.description.VerticalSubsampling = 1;
      switch (x.description.HorizontalSubsampling << 4 |
          x.description.VerticalSubsampling) {
        case 0x11: tags.sampling = [ 'YCbCr-4:4:4' ]; break;
        case 0x21: tags.sampling = [ 'YCbCr-4:2:2' ]; break;
        case 0x22: tags.sampling = [ 'YCbCr-4:2:0' ]; break;
        case 0x41: tags.sampling = [ 'YCbCr-4:1:1' ]; break;
        default: break;
      }
      switch (x.description.CodingEquations) {
        case '060e2b34-0401-0101-0401-010102010000':
          tags.colorimetry = [ 'BT601-5' ]; break;
        case '060e2b34.04010101.04010101.02020000':
          tags.colorimetry = [ 'BT709-2' ]; break;
        case '':
          tags.colorimetry = [ 'SMPTE240M' ]; break;
        default:
          tags.colorimetry = [ 'BT709-2' ]; break;
      }
      tags.sampleRate =
        [ `${x.description.SampleRate[0]}/${x.description.SampleRate[1]}` ];
      tags.interlace =
        [ `${(x.description.FrameLayout === 'SeparateFields') ? '1' : '0'}` ];
      return tags;
    default:
      return {};
  }
}

module.exports = function (RED) {
  function MXFIn (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);

    if (!this.context().global.get('updated'))
      return this.log("Waiting for global context update.");
    var node = this;
    this.config = config;

    this.nodeAPI = node.context().global.get('nodeAPI');
    this.ledger = node.context().global.get('ledger');
    this.flow = null;
    this.source = null;
    this.tags = {};
    this.grainDuration = [ 0, 1 ];
    this.grainCount = 0;
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];

    var mxfurl = url.parse(config.mxfUrl);
    switch (mxfurl.protocol) {
      case 'file:':
        fsaccess(mxfurl.pathname, fs.R_OK)
        .then(function () {
          node.highland(
            H(function (push, next) {
              push(null, H(fs.createReadStream(mxfurl.pathname));
              next();
            })
            .take(config.loop ? Number.MAX_SAFE_INTEGER : 1)
            .sequence()
            .through(klv.kelviniser())
            .through(klv.metatiser())
            .through(klv.stripTheFiller)
            .through(klv.detailing())
            .through(klv.puppeteer())
            .through(klv.trackCacher())
            .through(klv.essenceFilter('picture0'))
            .doto(node.extractFlowAndSource.bind(node))
            .map(function (x) {
              var grainTime = new Buffer(10);
              grainTime.writeUIntBE(node.baseTime[0], 0, 6);
              grainTime.writeUInt32BE(node.baseTime[1], 6);
              node.baseTime[1] = ( node.baseTime[1] +
                node.grainDuration[0] * 1000000000 / node.grainDuration[1]|0 );
              node.baseTime = [ node.baseTime[0] + node.baseTime[1] / 1000000000|0,
                node.baseTime[1] % 1000000000];
              var timecode = null;
              if (x.startTimecode) {
                var startTC = x.startTimecode;
                var baseTC = startTC.StartTimecode + node.grainCount;
                timecode = new Timecode( // FIXME drop frame calculations
                  baseTC / (3600 * startTC.FramesPerSecond)|0,
                  (baseTC / (60 * startTC.FramesPerSecond)|0) % 60,
                  (baseTC / startTC.FramesPerSecond|0) % 60,
                  baseTC % startTC.FramesPerSecond,
                  startTC.DropFrame, true);
              }
              node.grainCount++;
              return new Grain(x.value, grainTime, grainTime, timecode,
                node.flow.id, node.source.id, node.grainDuration);
            })
            .errors(function () { })
          );
        })
        .catch(node.preFlightError);
        break;
      case 'http:':
        break;
      case 'ftp:':
        break;
      default:
        node.preFlightError('MXF URL must be either file, http or ftp.');
        break;
    }
  }
  util.inherits(MXFIn, redioactive.Funnel);
  RED.nodes.registerType("mxf-in", MXFIn);

  MXFIn.prototype.extractFlowAndSource = function (x) {
    if (this.flow) return;
    this.tags = makeTags(x);
    if (x.description && x.description.SampleRate) {
      this.grainDuration = [ x.description.SampleRate[1], x.description.SampleRate[0] ];
    }
    var localName = this.config.name || `${this.config.type}-${this.config.id}`;
    var localDescription = this.config.description || `${this.config.type}-${this.config.id}`;
    var pipelinesID = this.config.device ?
      RED.nodes.getNode(this.config.device).nmos_id :
      this.context().global.get('pipelinesID');
    console.log('+++', localName, localDescription, pipelinesID);
    this.source = new this.ledger.Source(null, null, localName, localDescription,
      "urn:x-nmos:format:" + this.tags.format[0], null, null, pipelinesID, null);
    this.flow = new this.ledger.Flow(null, null, localName, localDescription,
      "urn:x-nmos:format:" + this.tags.format[0], this.tags, this.source.id, null);
    console.log('---', this.flow);
    this.nodeAPI.putResource(this.source).then(function () {
      return this.nodeAPI.putResource(this.flow);
    }.bind(this)).catch(this.error);
  }
}
