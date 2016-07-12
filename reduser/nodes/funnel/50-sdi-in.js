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
var macadam = require('macadam');
var Grain = require('../../../model/Grain.js');

function fixBMDCodes(code) {
  if (code === 'ARGB') return 32;
  return macadam.bmCodeToInt(code);
}

module.exports = function (RED) {
  function SDIIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');

    var capture = new macadam.Capture(config.deviceIndex,
      fixBMDCodes(config.mode), fixBMDCodes(config.format));
    var node = this;
    var grainDuration = macadam.modeGrainDuration(fixBMDCodes(config.mode));
    this.tags = {
      format : [ 'video' ],
      encodingName : [ 'raw' ],
      width : [ `${macadam.modeWidth(fixBMDCodes(config.mode))}` ],
      height : [ `${macadam.modeHeight(fixBMDCodes(config.mode))}` ],
      depth : [ `${macadam.formatDepth(fixBMDCodes(config.format))}` ],
      packing : [ macadam.formatFourCC(fixBMDCodes(config.format)) ],
      sampling : [ macadam.formatSampling(fixBMDCodes(config.format)) ],
      clockRate : [ '90000' ],
      interlace : [ (macadam.modeInterlace(fixBMDCodes(config.mode))) ? '1' : '0' ],
      colorimetry : [ macadam.formatColorimetry(fixBMDCodes(config.format)) ],
      grainDuration : [ `${grainDuration[0]}/${grainDuration[1]}`]
    };
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var localName = config.name || `${config.type}-${config.id}`;
    var localDescription = config.description || `${config.type}-${config.id}`;
    var pipelinesID = config.device ?
      RED.nodes.getNode(config.device).nmos_id :
      this.context().global.get('pipelinesID');
    var source = new ledger.Source(null, null, localName, localDescription,
      "urn:x-nmos:format:video", null, null, pipelinesID, null);
    var flow = new ledger.Flow(null, null, localName, localDescription,
      "urn:x-nmos:format:video", this.tags, source.id, null);
    nodeAPI.putResource(source).catch(node.warn);
    nodeAPI.putResource(flow).then(
      function (x) {
        node.log('Flow stored. Starting capture.');
        capture.start();
      },
      node.warn);

    this.eventMuncher(capture, 'frame', function (payload) {
      var grainTime = new Buffer(10);
      grainTime.writeUIntBE(this.baseTime[0], 0, 6);
      grainTime.writeUInt32BE(this.baseTime[1], 6);
      this.baseTime[1] = ( this.baseTime[1] +
        grainDuration[0] * 1000000000 / grainDuration[1]|0 );
      this.baseTime = [ this.baseTime[0] + this.baseTime[1] / 1000000000|0,
        this.baseTime[1] % 1000000000];
      return new Grain([payload], grainTime, grainTime, null,
        flow.id, source.id, grainDuration); // TODO Timecode support
    }.bind(this));

    capture.on('error', function (e) {
      this.push(e);
    }.bind(this));

    this.on('close', function () {
      this.close();
      capture.stop();
    });
  }
  util.inherits(SDIIn, redioactive.Funnel);
  RED.nodes.registerType("sdi-in", SDIIn);
}
