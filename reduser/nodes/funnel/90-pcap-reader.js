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
var Grain = require('../../../model/Grain.js');
var util = require('util');
var SDPProcessing = require('../../../util/SDPProcessing.js');

module.exports = function (RED) {
  function PCAPReader (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);
    // Do not run unless global config has been established
    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');
    fs.access(config.file, fs.R_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    var node = this;
    this.tags = {};
    this.grainCount = 0;
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
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
        this.context().global.get('pipelinesID');
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

  PCAPReader.prototype.sdpToTags = SDPProcessing.sdpToTags;
  PCAPReader.prototype.setTag = SDPProcessing.setTag;
  PCAPReader.prototype.sdpURLReader = SDPProcessing.sdpURLReader;
  PCAPReader.prototype.sdpToExt = SDPProcessing.sdpToExt;

  PCAPReader.prototype.testAccess = function (config) {
    setTimeout(() => { console.log('+=+', config, this.tags); }, 1000);
  }
}
