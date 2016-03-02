/* Copyright 2016 Christine S. MacNeill

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
var Queue = require('fastqueue');
var dgram = require('dgram');
var redioactive = require('../../../util/Redioactive.js')

function Funnel (config) {
  var queue = new Queue;
  var wireCount = config.wires[0].length;
  var pending = config.wires[0];
  var node = this;
  var nodeStatus = "";
  var paused = false;
  var soc = dgram.createSocket('udp4');
  function setStatus(fill, shape, text) {
    if (nodeStatus !== text && nodeStatus !== 'done') {
      node.status({ fill : fill, shape : shape, text: text});
      nodeStatus = text;
    }
  }
  setStatus('grey', 'ring', 'initialising');
  var maxBuffer = 10;
  if (config.maxBuffer && typeof config.maxBuffer === 'string')
    config.maxBuffer = +config.maxBuffer;
  if (config.maxBuffer && config.maxBuffer > 0) maxBuffer = config.maxBuffer|0;

  var pull = function (id) {
    node.log(`Pull received with id ${id}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (pending.indexOf(id) < 0) pending.push(id);
    if ((queue.length > 0) && (pending.length === wireCount)) {
      pending = [];
      var payload = queue.shift();
      var message = new Buffer(`punkd value=${payload}`)
      soc.send(message, 0, message.length, 8765);
      if (redioactive.isEnd(payload)) {
        work = function () { }
        next = function () {
          setStatus('grey', 'ring', 'done');
        };
        setStatus('grey', 'ring', 'done');
      };
      node.send({
        payload : payload,
        error : null,
        pull : pull
      });
    }
    if (paused && queue.length < 0.5 * maxBuffer) {
      node.log("Resuming.");
      paused = false;
      next();
    };
  };
  var push = function (err, val) {
    node.log(`Push received with value ${val}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (err) {
      setStatus('red', 'dot', 'error');
      node.send({
        payload : null,
        error : err,
        pull : pull
      });
    } else {
      if (queue.length <= maxBuffer) {
        // node.log(queue);
        queue.push(val);
      } else {
        node.warn(`Dropping value ${val} from buffer as maximum length of ${maxBuffer} exceeded.`);
      }

      if (pending.length === wireCount) {
        var payload = queue.shift();
        node.log(`Sending ${payload} with pending ${JSON.stringify(pending)}.`);
        pending = [];
        var message = new Buffer(`punkd value=${payload}`)
        soc.send(message, 0, message.length, 8765);
        if (redioactive.isEnd(payload)) {
          work = function () { }
          next = function () {
            setStatus('grey', 'ring', 'done');
          };
          setStatus('grey', 'ring', 'done');
        };
        node.send({
          payload : payload,
          error : null,
          pull : pull
        });
      };

      if (queue.length >= maxBuffer) {
        setStatus('red', 'dot', 'overflow');
      } else if (queue.length >= 0.75 * maxBuffer) {
        setStatus('yellow', 'dot', '75% full');
      } else {
        setStatus('green', 'dot', 'generating');
      }
    }
  };
  var next = function () {
    setTimeout(function () {
      if (queue.length < 0.8 * maxBuffer) {
        work(push, next);
      } else {
        paused = true;
        node.log("Pausing.");
      }
    }, 0);
  };
  var work = function () { };
  this.generator = function (cb) {
    work = cb;
    setStatus('green', 'dot', 'generating');
    next();
  }
  this.close = function (done) { // done is undefined :-(
    setStatus('yellow', 'ring', 'closing');
    next = function () {
      setStatus('grey', 'ring', 'closed');
    }
  }
  setInterval(function () {
    var usage = process.memoryUsage();
    var message = new Buffer(`remember,type=rss value=${usage.rss}\n` +
      `remember,type=heapTotal value=${usage.heapTotal}\n` +
      `remember,type=heapUsed value=${usage.heapUsed}`);
    soc.send(message, 0, message.length, 8765);
  }, 1000);
}

module.exports = function (RED) {
  function GlobIn (config) {
    Funnel.call(this, config);
    this.log(JSON.stringify(config, null, 2));
    RED.nodes.createNode(this,config);
    this.count = 0;
    this.generator(function (push, next) {
      if (this.count < 10000) {
        push(null, this.count++);
        next();
      } else {
        push(null, redioactive.end);
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(GlobIn, Funnel);
  RED.nodes.registerType("glob-in",GlobIn);
};
