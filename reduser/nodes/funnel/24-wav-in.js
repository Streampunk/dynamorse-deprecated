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
var H = require('highland');
var fs = require('fs');
var uuid = require('uuid');
var Grain = require('../../../model/Grain.js');

function wavInlet(file, loop, grps) {
  var bitsPerSample = 16;
  var channels = 2;
  var blockAlign = 4;
  var sampleRate = 48000;
  var foundHeader = false;
  var foundData = false;
  var grainCount = 0;
  var leftOver = null;
  var pattern = [ 1902 ];
  var nextLen = 0;
  var wavConsumer = function (err, b, push, next) {
    if (err) {
      push(err);
      next();
    }
    else if (b === H.nil) {
      if (leftOver && leftOver.length > 0) push (null, leftOver);
      push(null, b);
    } else {
      var position = 0;
      if (b.length >= 36 &&
          b.readUInt32BE(0) === 0x52494646 && // RIFF
          b.readUInt32BE(8) == 0x57415645) { // WAVE
        bitsPerSample = b.readUInt16LE(34);
        channels = b.readUInt16LE(22);
        sampleRate = b.readUInt32LE(24);
        blockAlign = b.readUInt16LE(32);
        // Improve patter for other common grain rates
        pattern = (grps === 29.97 && sampleRate === 48000) ? [ 1602, 1601, 1602, 1601, 1602 ] :
          [ sampleRate / Math.round(grps) ];
        var tags = {
          format : [ 'audio' ],
          channels : [ `${channels}` ],
          clockRate : [ `${sampleRate}` ],
          encodingName : [ `L${bitsPerSample}` ],
          blockAlign : [ `${blockAlign}` ]
        };
        push(null, tags);
        foundHeader = true;
        foundData = false;
        position += 36;
      }
      if (foundHeader) {
        while (!foundData && position < b.length) {
          if (b.readUInt32BE(position) === 0x64617461) { // data
            foundData = true;
            position += 8;
          }
          else { position += 1; }
        }
        if (foundData) {
          nextLen = pattern[grainCount % pattern.length] * blockAlign;
          if (leftOver && leftOver.length > 0 &&
              position + nextLen - leftOver.length <= b.length) {
            var overlap = Buffer.concat(
              [leftOver, b.slice(position, position + nextLen - leftOver.length)],
              nextLen);
            push(null, swapBytes(overlap, bitsPerSample));
            position += nextLen - leftOver.length;
            grainCount++;
            nextLen = pattern[grainCount % pattern.length] * blockAlign;
            leftOver = null;
          }
          while (position + nextLen <= b.length) {
            push(null, swapBytes(b.slice(position, position + nextLen), bitsPerSample));
            grainCount++;
            position += nextLen;
            nextLen = pattern[grainCount % pattern.length] * blockAlign;
          }
          if (position < b.length) {
            leftOver = b.slice(position);
          } else {
            leftOver = null;
          }
        }
      }
      next();
    }
  };
  return H(function (push, next) {
      push(null, H(fs.createReadStream(file)));
      next();
    })
    .take(loop ? Number.MAX_SAFE_INTEGER : 1)
    .sequence()
    .consume(wavConsumer);
}

function swapBytes(x, bitsPerSample) {
  switch (bitsPerSample) {
    case 24:
      var tmp = 0|0;
      for ( var y = 0|0 ; y < x.length ; y += 3|0 ) {
        tmp = x[y];
        x[y] = x[y + 2];
        x[y + 2] = tmp;
      }
      break;
    case 16:
      var tmp = 0|0;
      for ( var y = 0|0 ; y < x.length ; y += 2|0 ) {
        tmp = x[y];
        x[y] = x[y + 1];
        x[y + 1] = tmp;
      }
      break;
    default: // No swap
      break;
  }
  return x;
}

module.exports = function (RED) {
  function WAVIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);
    if (!this.context().global.get('updated')) {
      this.log('False start for WAV funnel.');
      return;
    }
    fs.access(config.file, fs.R_OK, function (e) {
      if (e) {
        return this.preFlightError(e);
      }
    }.bind(this));
    var node = this;
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
    this.blockAlign = 4;
    this.sampleRate = 48000;
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var localName = config.name || `${config.type}-${config.id}`;
    var localDescription = config.description || `${config.type}-${config.id}`;
    var pipelinesID = config.device ?
      RED.nodes.getNode(config.device).nmos_id :
      this.context().global.get('pipelinesID');
    var source = new ledger.Source(null, null, localName, localDescription,
      "urn:x-nmos:format:audio", null, null, pipelinesID, null);
    var flowID = uuid.v4();
    nodeAPI.putResource(source).then(function () {
      this.highland(
        wavInlet(config.file, config.loop, +config.grps)
        .doto(function (tags) {
          if (typeof tags === 'object' && !Buffer.isBuffer(tags)) { // Assume it is tags
            var flow = new ledger.Flow(flowID, null, localName, localDescription,
              "urn:x-nmos:format:audio", tags, source.id, null);
            nodeAPI.putResource(flow).catch(node.warn);
            this.blockAlign = +tags.blockAlign[0];
            this.sampleRate = +tags.clockRate[0];
          }
        }.bind(this))
        .filter(Buffer.isBuffer)
        .map(function (b) {
          var grainTime = new Buffer(10);
          grainTime.writeUIntBE(this.baseTime[0], 0, 6);
          grainTime.writeUInt32BE(this.baseTime[1], 6);
          var grainDuration = [ b.length / this.blockAlign|0, this.sampleRate ];
          this.baseTime[1] = ( this.baseTime[1] +
            grainDuration[0] * 1000000000 / grainDuration[1]|0 );
          this.baseTime = [ this.baseTime[0] + this.baseTime[1] / 1000000000|0,
            this.baseTime[1] % 1000000000];
          return new Grain([b], grainTime, grainTime, null,
            flowID, source.id, grainDuration);
        }.bind(this))
      );
    }.bind(this), function(err) {
      if (err) return node.log(`Unable to register source: ${err}`);
    });
  }
  util.inherits(WAVIn, redioactive.Funnel);
  RED.nodes.registerType("wav-in", WAVIn);
}
