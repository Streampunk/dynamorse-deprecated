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
var udpInlet = require('../../../funnel/udpInlet.js');
var udpToGrain = require('../../../valve/udpToGrain.js');
var grainConcater = require('../../../valve/grainConcater.js');
var Grain = require('../../../model/Grain.js');
var H264 = require('../../../util/H264.js');
var http = require('http');
var Promise = require('promise');
var mdns = null;

module.exports = function (RED) {
  function NmosRTPIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');
    var node = this;
    this.tags = {};
    this.exts = {};
    this.sdp = {};
    var client = dgram.createSocket({type  :'udp4', reuseAddr : true});
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var source = null;
    var flow = null;
    var recvr = null;
    (new Promise(function (complete, reject) {
      if (!config.sender) return complete();
      if (config.sender.startsWith('http')) return complete();
      var selectionTimer = null;
      var candidates = [];
      var queryURL = '';
      if (!mdns) mdns = require('mdns-js');
      var browser = mdns.createBrowser('_nmos-query._tcp.local.');
      mdns.excludeInterface('0.0.0.0');
      function selectCandidate(candidates) {
        function extractPri(x) {
          console.log(x.txt[0]);
          var match = x.txt[0].match(/pri=([0-9]+)/);
          if (match) return +match[1];
          else return NaN;
        }
        if (candidates.length > 0) {
          var selected = candidates.sort(function (x, y) {
            return extractPri(x) > extractPri(y);
          })[0];
          node.log(`Selected query service at http://${selected.addresses[0]}:${selected.port} ` +
            `with priority ${extractPri(selected)}.`);
          if (config.sender.indexOf('=') < 0 && !config.sender.endsWith('/'))
            config.sender = config.sender + '/';
          else config.sender = '?' + config.sender;
          config.sender =
            `http://${selected.addresses[0]}:${selected.port}/x-nmos/query/v1.0/senders/${config.sender}`;
          browser.stop();
          complete();
        } else {
          reject('Failed to find a query service.');
        }
      }; // selectCandidate
      browser.on('ready', function () {
        node.log('Ready for MDNS.');
        candidates = [];
        browser.discover();
      });
      browser.on('update', function (data) {
        node.log('MDNS update');
        if (data.fullname && data.fullname.indexOf('_nmos-query._tcp') >= 0) {
          node.log(`Found a query service ${data.fullname} ${(data.txt.length > 0) ? data.txt[0] : ""}`);
          candidates.push(data);
          if (!selectionTimer) selectionTimer = setTimeout(function () {
            selectCandidate(candidates);
          }, 1000);
        };
      });
      browser.on('error', reject);

    })).then(function () {
      return new Promise(function (complete, reject) {
        if (!config.sender) return complete();
        http.get(config.sender, function (res) {
          res.on('error', reject);
          if (!res.statusCode === 200)
            return reject(`Error code ${res.statusCode} when requesting sender details.`);
          var senderStr = '';
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            senderStr += chunk;
          });
          res.on('end', function () {
            var sender = JSON.parse(senderStr);
            if (Array.isArray(sender)) sender = sender[0];
            config.sdpURL = sender.manifest_href;
            config.sender = sender.id;
            complete();
          });
        });
      });
    })
    .then(function () {
      return this.sdpURLReader(config);
    }.bind(this))
    .then(function (data) {
      var localName = config.name || `${config.type}-${config.id}`;
      var localDescription = config.description || `${config.type}-${config.id}`;
      console.log(config.device,
        RED.nodes.getNode(config.device),
        this.context().global.get('pipelinesID'));
      var pipelinesID = config.device ?
        RED.nodes.getNode(config.device).nmos_id :
        this.context().global.get('pipelinesID');
      source = new ledger.Source(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], null, null, pipelinesID, null);
      flow = new ledger.Flow(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], this.tags, source.id, null);
      recvr = new ledger.Receiver(null, null, localName, localDescription,
        "urn:x-nmos:format:" + this.tags.format[0], null, this.tags,
        pipelinesID, ledger.transports.rtp_mcast,
        (typeof config.sender === 'string' && config.sender.length > 0) ?
          { sender_id : config.sender } : null);
        return nodeAPI.putResource(source);
    }.bind(this))
    .then(function () {
      return nodeAPI.putResource(flow);
    })
    .then(function () {
      return nodeAPI.putResource(recvr);
    })
    .then(function () {
      console.log('Starting highland pipeline.');
      var is6184 = this.tags.encodingName[0].toLowerCase() === 'h264';
      this.highland(
        udpInlet(client, this.sdp, config.netif)
        .pipe(udpToGrain(this.exts, this.tags.format[0].endsWith('video')))
        .map(function (g) {
          if (is6184) H264.backToAVC(g);
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
    }.bind(this))
    .catch(function(err) {
      if (err) return node.log(`Unable to start NMOS RTP in: ${err}`);
    });
    this.on('close', function () {
      this.close();
      if (browser) browser.stop();
      nodeAPI.deleteResource(recvr, "receiver")
      .catch(function (err) {
        node.log(`Unable to de-register resource: ${err}`);
      });
    }.bind(this)); // Delete flows when we're done?
  }
  util.inherits(NmosRTPIn, redioactive.Funnel);
  RED.nodes.registerType("nmos-rtp-in", NmosRTPIn);

  NmosRTPIn.prototype.sdpToTags = SDPProcessing.sdpToTags;
  NmosRTPIn.prototype.setTag = SDPProcessing.setTag;
  NmosRTPIn.prototype.sdpURLReader = Promise.denodeify(SDPProcessing.sdpURLReader);
  NmosRTPIn.prototype.sdpToExt = SDPProcessing.sdpToExt;
}
