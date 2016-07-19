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
var codecadon = require('codecadon');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function Converter (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.srcFlow = null;
    var dstFlow = null;
    var dstBufLen = 0;

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');

    var converter = new codecadon.ScaleConverter(function() {
      console.log('Converter exiting');
    });
    converter.on('error', function(err) {
      console.log('Converter error: ' + err);
    });

    var node = this;
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var localName = config.name || `${config.type}-${config.id}`;
    var localDescription = config.description || `${config.type}-${config.id}`;
    var pipelinesID = config.device ?
      RED.nodes.getNode(config.device).nmos_id :
      this.context().global.get('pipelinesID');

    var source = new ledger.Source(null, null, localName, localDescription,
      ledger.formats.video, null, null, pipelinesID, null);

    function processGrain(x, dstBufLen, push, next) {
      var dstBuf = new Buffer(dstBufLen);
      var numQueued = converter.scaleConvert(x.buffers, dstBuf, function(err, result) {
        if (err) {
          push(err);
        } else if (result) {
          push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
                               x.timecode, dstFlow.id, source.id, x.duration));
        }
        next();
      });
    }

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        converter.quit(function() {
          push(null, x);
        });
      } else if (Grain.isGrain(x)) {
        if (!this.srcFlow) {
          this.getNMOSFlow(x, function (err, f) {
            if (err) return push("Failed to resolve NMOS flow.");
            this.srcFlow = f;

            var dstTags = JSON.parse(JSON.stringify(this.srcFlow.tags));
            dstTags["width"] = [ `${config.dstWidth}` ];
            dstTags["height"] = [ `${config.dstHeight}` ];
            dstTags["packing"] = [ `${config.dstFormat}` ];
            if ("420P" === config.dstFormat) {
              dstTags["depth"] = [ "8" ];
              dstTags["sampling"] = [ "YCbCr-4:2:0" ];
            }
            else {
              dstTags["depth"] = [ "10" ];
              dstTags["sampling"] = [ "YCbCr-4:2:2" ];
            }

            var formattedDstTags = JSON.stringify(dstTags, null, 2);
            RED.comms.publish('debug', {
              format: "Converter output flow tags:",
              msg: formattedDstTags
            }, true);

            dstFlow = new ledger.Flow(null, null, localName, localDescription,
              ledger.formats.video, dstTags, source.id, null);

            nodeAPI.putResource(source).catch(function(err) {
              push(`Unable to register source: ${err}`)
            });
            nodeAPI.putResource(dstFlow).then(function() {
              dstBufLen = converter.setInfo(this.srcFlow.tags, dstTags);
              processGrain(x, dstBufLen, push, next);
            }.bind(this), function (err) {
              push(`Unable to register flow: ${err}`);
            });
          }.bind(this));
        } else {
          processGrain(x, dstBufLen, push, next);
        }
      } else {
        push(null, x);
        next();
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(Converter, redioactive.Valve);
  RED.nodes.registerType("converter", Converter);
}
