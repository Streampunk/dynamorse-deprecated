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
  function AACEncoder (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.srcFlow = null;
    var dstFlow = null;
    var dstBufLen = 0;
    var numChannels = 2;

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');

    var encoder = new codecadon.Encoder(function() {
      console.log('AAC Encoder exiting');
    });
    encoder.on('error', function(err) {
      console.log('AAC Encoder error: ' + err);
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

    var packetNumBytes = 8192;
    var lastBuf = Buffer.alloc(0);

    function processGrain(x, dstBufLen, push, next) {
      var curStart = 0;
      var numSrcPkts = 0;
      var numDstPkts = 0;
 
      while (curStart + packetNumBytes - lastBuf.length < x.buffers[0].length) {
        var packet = Buffer.concat([lastBuf, x.buffers[0].slice(curStart, curStart + packetNumBytes - lastBuf.length)], packetNumBytes);
        curStart += packetNumBytes - lastBuf.length;
        if (lastBuf.length)
          lastBuf = Buffer.alloc(0);
        numSrcPkts++;

        var dstBuf = new Buffer(dstBufLen);
        var numQueued = encoder.encode([packet], dstBuf, function(err, result) {
          numDstPkts++;
          if (err) {
            push(err);
          } else if (result) {
            push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
                                 x.timecode, dstFlow.id, source.id, x.duration));
          }
          if (numDstPkts === numSrcPkts)
            next();
        });
      }
      lastBuf = Buffer.concat([lastBuf, x.buffers[0].slice(curStart, x.buffers[0].length)], lastBuf.length + x.buffers[0].length - curStart);
      if (!numSrcPkts) // this grain didn't fill the encode packet 
        next();
    }

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        encoder.quit(function() {
          push(null, x);
        });
      } else if (Grain.isGrain(x)) {
        if (!this.srcFlow) {
          this.getNMOSFlow(x, function (err, f) {
            if (err) return push("Failed to resolve NMOS flow.");
            this.srcFlow = f;
            var srcTags = this.srcFlow.tags;
            if (srcTags.format[0] === "video") {
              push("Video grain not supported by AAC encoder!!");
              next();
              return;
            }

            var dstTags = JSON.parse(JSON.stringify(this.srcFlow.tags));
            var encodeTags = {};
            dstTags["encodingName"] = [ "AAC" ];
            encodeTags["bitrate"] = [ `${config.bitrate}` ];
            var numChannels = +srcTags.channels[0];
            var bitsPerSample = +srcTags.encodingName[0].substring(1);
            packetNumBytes = 1024 * numChannels * (((bitsPerSample+7) / 8) >>> 0);

            var formattedDstTags = "flow: " + JSON.stringify(dstTags, null, 2) + ", encode settings: " + JSON.stringify(encodeTags, null, 2);
            RED.comms.publish('debug', {
              format: "Encoder output flow tags:",
              msg: formattedDstTags
            }, true);

            dstFlow = new ledger.Flow(null, null, localName, localDescription,
              ledger.formats.audio, dstTags, source.id, null);

            nodeAPI.putResource(source).catch(function(err) {
              push(`Unable to register source: ${err}`);
            });
            nodeAPI.putResource(dstFlow).then(function() {
              dstBufLen = encoder.setInfo(this.srcFlow.tags, dstTags, x.duration, encodeTags);
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
  util.inherits(AACEncoder, redioactive.Valve);
  RED.nodes.registerType("AAC encoder", AACEncoder);
}
