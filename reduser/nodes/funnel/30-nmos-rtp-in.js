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
var SDPProcessing = require('../../../util/SDPProcessing.js');
var dgram = require('dgram');

module.exports = function (RED) {
  function NmosRTPIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);

    if (!this.context().global.get('updated')) {
      this.log('False start for NMOS RTP input funnel.');
      return;
    }
    var node = this;
    this.tags = {};
    this.exts = {};
    var client = dgram.createSocket({type  :'udp4', reuseAddr : true});
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    // TODO resolve from NMOS query API
    this.sdpURLReader(config, function (err, data, sdp) {
      if (err) {
        return this.preFlightError(err);
      }
      var localName = config.name || `${config.type}-${config.id}`;
      var localDescription = config.description || `${config.type}-${config.id}`;
      console.log(config.device,
        RED.nodes.getNode(config.device),
        this.context().global.get('pipelinesID'));
      var pipelinesID = config.device ?
        RED.nodes.getNode(config.device).nmos_id :
        this.context().global.get('pipelinesID');
      var source = new ledger.Source(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], null, null, pipelinesID, null);
      var flow = new ledger.Flow(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], this.tags, source.id, null);
      // console.log(nodeAPI.getStore());
      nodeAPI.putResource(source, function(err, result) {
        if (err) return node.log(`Unable to register source: ${err}`);
      });
      nodeAPI.putResource(flow).then(function () {
        console.log('Starting highland pipeline.');
        this.highland(
          udpInlet(client, sdp)
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
          .pipe(grainConcater(this.tags))
        );
      }.bind(this), function(err, result) {
        if (err) return node.log(`Unable to register flow: ${err}`);
      });
    }.bind(this));
    this.on('close', this.close); // Delete flows when we're done?
  }
  util.inherits(NmosRTPIn, redioactive.Funnel);
  RED.nodes.registerType("nmos-rtp-in", NmosRTPIn);

  NmosRTPIn.prototype.sdpToTags = SDPProcessing.sdpToTags;
  NmosRTPIn.prototype.setTag = SDPProcessing.setTag;
  NmosRTPIn.prototype.sdpURLReader = SDPProcessing.sdpURLReader;
  NmosRTPIn.prototype.sdpToExt = SDPProcessing.sdpToExt;
}
