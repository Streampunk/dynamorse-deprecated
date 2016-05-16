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
var codecadon = require('../../../../codecadon');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function Encoder (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.srcFlow = null;
    var dstFlow = null;
    var dstBufLen = 0;

    var encoder = new codecadon.Encoder(function() {
      console.log('Encoder exiting');
    });
    encoder.on('error', function(err) {
      console.log('Encoder error: ' + err);
    });

    var node = this;
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var localName = config.name || `${config.type}-${config.id}`;
    var localDescription = config.description || `${config.type}-${config.id}`;
    var pipelinesID = config.device ?
      RED.nodes.getNode(config.device).nmos_id :
      this.context().global.get(pipelinesID);

    var source = new ledger.Source(null, null, localName, localDescription,
      ledger.formats.video, null, null, pipelinesID, null);

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        encoder.quit(function() {
          push(null, x);
        });
      } else {
        if (!this.srcFlow) {
          this.getNMOSFlow(x, function (err, f) {
            if (err) return push("Failed to resolve NMOS flow.");
            this.srcFlow = f;

            var dstTags = JSON.parse(JSON.stringify(this.srcFlow.tags));
            dstTags["packing"] = [ `${config.dstFormat}` ];
            dstFlow = new ledger.Flow(null, null, localName, localDescription,
              ledger.formats.video, dstTags, source.id, null);

            nodeAPI.getStore().putSource(source, function(err, src, deltaStore) {
              if (err) return push(`Unable to register source: ${err}`);
              deltaStore.putFlow(dstFlow, function(err, flw, readyStore) {
                if (err) return push(`Unable to register flow: ${err}`);
                nodeAPI.setStore(readyStore);
              });
            });

            dstBufLen = encoder.setInfo(this.srcFlow.tags, dstTags);
            setTimeout(function () { 
              push(null, new Grain(x.buffers, x.ptpSync, x.ptpOrigin, 
                                   x.timecode, dstFlow.id, source.id, x.duration));
              next();
            }, 50);
          }.bind(this));
        } else if (Grain.isGrain(x)) {
          var dstBuf = new Buffer(dstBufLen);
          var numQueued = encoder.encode(x.buffers, dstBuf, function(err, result) {
            if (err) {
              push(err);
            } else if (result) {
              push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
                                   x.timecode, dstFlow.id, source.id, x.duration));
            }
            next();
          });
          // allow a number of packets to queue ahead
          if (numQueued < +config.maxBuffer) {
            next();
          }
        } else {
          push(null, x);
          next();
        }
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(Encoder, redioactive.Valve);
  RED.nodes.registerType("encoder", Encoder);
}
