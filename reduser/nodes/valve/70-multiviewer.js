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
var uuid = require('uuid');

function Queue() {
  this.stack = [];
  this.entry = function(i) {
    // flip so that the stack appears to be a fifo not a lifo!!
    return this.stack[this.length() - i - 1];
  } 
  this.front = function() {
    return this.entry(0); 
  } 
  this.dequeue = function() {
    return this.stack.pop(); 
  } 
  this.enqueue = function(item) {
    this.stack.unshift(item);
  }
  this.length = function() {
    return this.stack.length;
  }
}

function srcSlot(grain, slotNum) {
  this.grain = grain;
  this.slotNum = slotNum;
}

function dstTile(dstBufBytes, numSlots) {
  this.dstBuf = new Buffer(dstBufBytes);
  this.numEmptySlots = numSlots;
}

dstTile.prototype.setSlotDone = function() {
  if (this.numEmptySlots > 0)
    --this.numEmptySlots;
}

dstTile.prototype.forceAllDone = function() {
  this.numEmptySlots = 0;
}

dstTile.prototype.isDone = function() {
  return 0 === this.numEmptySlots;
}

function multiviewSlots(numSlots, maxQueue, dstBufBytes) {
  this.numSlots = numSlots;
  this.maxQueue = maxQueue;
  this.dstBufBytes = dstBufBytes;

  this.dstTiles = new Queue();
  this.slotQueue = [];
  for (var i=0; i<this.numSlots; ++i)
    this.slotQueue[i] = new Queue();
}

multiviewSlots.prototype.addDstTile = function() {
  var newDstTile = new dstTile(this.dstBufBytes, this.numSlots);
  this.dstTiles.enqueue(newDstTile);
  return newDstTile;
}

multiviewSlots.prototype.addSrcSlot = function(x, slotNum) {
  var curQueue = this.slotQueue[slotNum];
  var curSrcSlot = new srcSlot(x, slotNum);

  var curDstTile = null;
  var curIndex = curQueue.length();
  if (this.dstTiles.length() === curIndex)
    curDstTile = this.addDstTile();
  else
    curDstTile = this.dstTiles.entry(curIndex);

  if (0 === curDstTile.numEmptySlots) {
    console.log("Discarding srcSlot tile " + slotNum + " - dstTile marked as full!!");
    return;
  }
  curQueue.enqueue(curSrcSlot);

  return curDstTile;
}

multiviewSlots.prototype.setSlotDone = function(dstTile) {
  dstTile.setSlotDone();

  var doneDstTile = null;
  frontDstTile = this.dstTiles.front();
  if (frontDstTile) {
    if ((this.dstTiles.length() > this.maxQueue) && !frontDstTile.isDone()) {
      console.log("Forcing flush of partially complete multiviewer tile");
      frontDstTile.forceAllDone();
    }
  
    if (frontDstTile.isDone()) {
      doneDstTile = this.dstTiles.dequeue();
      for (var i=0; i<this.numSlots; ++i) {
        this.slotQueue[i].dequeue();
      }
    }
  }

  return doneDstTile; 
}

module.exports = function (RED) {
  function Multiviewer (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);

    this.srcFlows = [];
    this.dstOrgs = [];

    var dstFlow = null;
    var dstBufLen = 0;
    var nextSrcFlow = 0;
    var maxQueue = 2;

    this.multiviewSetup = RED.nodes.getNode(config.multiviewSetup);
    if (!this.multiviewSetup)
      return node.log("Multiviewer setup config not found!!");

    var numTiles = +this.multiviewSetup.tiles;
    var numHTiles = numTiles / 2;
    var numVTiles = numHTiles;
    this.multiviewSetup.tileWidth = +config.dstWidth / numHTiles;
    this.multiviewSetup.tileHeight = +config.dstHeight / numVTiles;
    this.multiviewSetup.tileFormat = config.dstFormat;

    var i=0;
    for (var v=0; v<numVTiles; ++v)
      for (var h=0; h<numHTiles; ++h)
        this.dstOrgs[i++] = [(+config.dstWidth * h) / numHTiles, (+config.dstHeight * v) / numVTiles];

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');

    var stamper = new codecadon.Stamper(function() {
      console.log('Stamper exiting');
    });
    stamper.on('error', function(err) {
      console.log('Stamper error: ' + err);
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

    function checkSrcFlowIds(flowId) {
      for (var i=0; i<numTiles; ++i) {
        if (node.srcFlows[i] && (flowId === node.srcFlows[i].id))
          return i;
      }
    }

    function processGrain(x, slotNum, push, next) {
      var dstTile = node.mv.addSrcSlot(x, slotNum);
      if (!dstTile) { next(); return; }

      var paramTags = { dstOrg:node.dstOrgs[slotNum] };
      stamper.copy(x.buffers, dstTile.dstBuf, paramTags, function(err, result) {
        if (err) {
          push(err);
        } else {
          var doneDstTile = node.mv.setSlotDone(dstTile);
          if (doneDstTile) {
            push(null, new Grain(doneDstTile.dstBuf, x.ptpSync, x.ptpOrigin,
                                 x.timecode, dstFlow.id, source.id, x.duration));
          }
        }
        next();
      });
    }

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        stamper.quit(function() {
          push(null, x);
        });
      } else if (Grain.isGrain(x)) {
        var grainFlowId = uuid.unparse(x.flow_id);
        var slotNum = checkSrcFlowIds(grainFlowId);
        if (undefined === slotNum) {
          this.getNMOSFlow(x, function (err, f) {
            if (err) return push("Failed to resolve NMOS flow.");
            slotNum = nextSrcFlow++;
            var firstGrain = this.srcFlows.length === 0;
            this.srcFlows[slotNum] = f;

            if (firstGrain) {
              console.log("New dest flow");
              var dstTags = JSON.parse(JSON.stringify(f.tags));
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
              dstBufLen = stamper.setInfo(f.tags, dstTags);
              node.mv = new multiviewSlots(numTiles, maxQueue, dstBufLen);

              var formattedDstTags = JSON.stringify(dstTags, null, 2);
              RED.comms.publish('debug', {
                format: "Multiviewer output flow tags:",
                msg: formattedDstTags
              }, true);

              dstFlow = new ledger.Flow(null, null, localName, localDescription,
                ledger.formats.video, dstTags, source.id, null);

              nodeAPI.putResource(source).catch(function(err) {
                push(`Unable to register source: ${err}`)
              });
              nodeAPI.putResource(dstFlow).then(function() {
                processGrain(x, slotNum, push, next);
              }.bind(this), function (err) {
                push(`Unable to register flow: ${err}`);
              });
            } else {
              processGrain(x, slotNum, push, next);
            }
          }.bind(this));
        } else {
          processGrain(x, slotNum, push, next);
        }
      } else {
        push(null, x);
        next();
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(Multiviewer, redioactive.Valve);
  RED.nodes.registerType("multiviewer", Multiviewer);
}
