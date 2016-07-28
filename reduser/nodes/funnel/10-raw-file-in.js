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
var Promise = require('promise');
var fs = require('fs');
var grainConcater = require('../../../valve/grainConcater.js');
var Grain = require('../../../model/Grain.js');
var H = require('highland');
var uuid = require('uuid');

function rawInlet(file, sizes, loop) {
  console.log('RAW INLET CALLED WITH', typeof sizes);
  var flowID = uuid.v4();
  var sourceID = uuid.v4();
  var bufs = [];
  var pointer = 0;
  var remaining = null;
  var grainCount = 0;
  var fixedChomper = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (remaining) {
        bufs.push(remaining);
        pointer += remaining.length;
        remaining = null;
      }
      if (pointer + x.length < sizes) {
        bufs.push(x);
        pointer += x.length;
      } else if (sizes - pointer > 0) {
        bufs.push(x.slice(0, sizes - pointer));
        remaining = x.slice(pointer);
        pointer = sizes;
      }
      if (pointer === sizes) {
        push(null, new Grain(bufs, 0, 0, null, flowID, sourceID, null));
        bufs = [];
        pointer = 0;
      }
      next();
    }
  };
  var nextGrain = null;
  var nextLength = null;
  var variableChomper = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil || grainCount >= sizes.length) {
      push(null, H.nil);
    } else {
      if (!nextGrain) {
        nextGrain = sizes[grainCount];
        nextLength = nextGrain.payloadSize;
      }
      if (remaining) {
        bufs.push(remaining);
        pointer += remaining.length;
        remaining = null;
      }
      // console.log(pointer, x.length, nextLength);
      if (pointer + x.length < nextLength) {
        bufs.push(x);
        pointer += x.length;
      } else if (nextLength - pointer > 0) {
        bufs.push(x.slice(0, nextLength - pointer));
        remaining = x.slice(pointer);
        pointer = nextLength;
      }
      if (pointer === nextLength) {
        push(null, new Grain(bufs, nextGrain.ptpSyncTimestamp,
          nextGrain.ptpOriginTimestamp, nextGrain.timecode,
          nextGrain.flow_id, nextGrain.source_id, nextGrain.duration));
        bufs = [];
        pointer = 0;
        nextGrain = null;
        grainCount++;
      }
      next();
    }
  };
  return H(function (push, next) {
      push(null, H(fs.createReadStream(file)));
      grainCount = 0;
      next();
    })
    .take(loop ? Number.MAX_SAFE_INTEGER : 1)
    .sequence()
    .consume((typeof sizes === 'number') ? fixedChomper : variableChomper);
}

module.exports = function (RED) {
  var fsaccess = Promise.denodeify(fs.access);
  var fsreadFile = Promise.denodeify(fs.readFile);
  function RawFileIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);
    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');
    var node = this;

    this.tags = {};
    this.grainCount = 0;
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
    this.exts = RED.nodes.getNode(
      this.context().global.get('rtp_ext_id')).getConfig();
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    this.headers = [];
    this.source = null;
    this.flow = null;

    fsaccess(config.file, fs.R_OK)
    .then(function () {
      if (config.headers) {
        return fsaccess(config.headers, fs.R_OK);
      }
    })
    .then(function () {
      if (config.headers) {
        return fsreadFile(config.headers).then(JSON.parse).then(function (heads) {
          node.headers = heads;
          if (node.headers.length > 0 && node.headers[0].contentType) {
            var contentType = node.headers[0].contentType;
            var tags = {};
            var mime = contentType.match(/^\s*(\w+)\/(\w+)/);
            tags.format = [ mime[1] ];
            tags.encodingName = [ mime[2] ];
            if (mime[1] === 'video' && mime[2] === 'raw') {
              tags.clockRate = [ '90000' ];
              tags.packing = [ 'pgroup' ];
            }
            var parameters = contentType.match(/\b(\w+)=(\S+)\b/g);
            parameters.forEach(function (p) {
              var splitP = p.split('=');
              if (splitP[0] === 'rate') splitP[0] = 'clockRate';
              tags[splitP[0]] = [ splitP[1] ];
            });
            return tags;
          }
          return null;
        });
      } else {
        return null;
      }
    })
    .then(function (tags) {
      if (!tags) {
        return node.sdpURLReader(config);
      } else {
        return tags;
      }
    })
    .then(function (tags) {
      node.tags = tags;
      var localName = config.name || `${config.type}-${config.id}`;
      var localDescription = config.description || `${config.type}-${config.id}`;
      var pipelinesID = config.device ?
        RED.nodes.getNode(config.device).nmos_id :
        node.context().global.get('pipelinesID');
      node.source = new ledger.Source(null, null, localName, localDescription,
        "urn:x-nmos:format:" + node.tags.format[0], null, null, pipelinesID, null);
      node.flow = new ledger.Flow(null, null, localName, localDescription,
        "urn:x-nmos:format:" + node.tags.format[0], this.tags, node.source.id,
        (node.headers.length > 0) ? [ node.headers[0].flow_id ] : []);
      return nodeAPI.putResource(node.source).then(function () {
        return nodeAPI.putResource(node.flow); });
    })
    .then(function () {
      node.highland(
        rawInlet(
          config.file,
          (node.headers.length === 0) ? +config.grainSize : node.headers,
          config.loop)
        .map(function (g) {
          if (node.headers.length > 0 && config.regenerate === false) {
            return new Grain(g.buffers, g.ptpSync, g.ptpOrigin, g.timecode,
              node.flow.id, node.source.id, g.duration);
          } // otherwise regenerate grain metadata
          var grainTime = new Buffer(10);
          grainTime.writeUIntBE(node.baseTime[0], 0, 6);
          grainTime.writeUInt32BE(node.baseTime[1], 6);
          var grainDuration = g.getDuration();
          node.baseTime[1] = ( node.baseTime[1] +
            grainDuration[0] * 1000000000 / grainDuration[1]|0 );
          node.baseTime = [ node.baseTime[0] + node.baseTime[1] / 1000000000|0,
            node.baseTime[1] % 1000000000];
          return new Grain(g.buffers, grainTime,
            (node.headers.length === 0) ? grainTime : g.ptpOrigin,
            g.timecode, node.flow.id, node.source.id, g.duration);
        })
        .pipe(grainConcater(node.tags))
      );
    })
    .catch(node.preFlightError);
    node.log('Set up promises for raw file in.');
  }
  util.inherits(RawFileIn, redioactive.Funnel);
  RED.nodes.registerType("raw-file-in", RawFileIn);

  RawFileIn.prototype.sdpToTags = SDPProcessing.sdpToTags;
  RawFileIn.prototype.setTag = SDPProcessing.setTag;
  RawFileIn.prototype.sdpURLReader = Promise.denodeify(SDPProcessing.sdpURLReader);
  RawFileIn.prototype.sdpToExt = SDPProcessing.sdpToExt;
}
