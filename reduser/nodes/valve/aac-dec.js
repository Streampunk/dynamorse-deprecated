/* Copyright 2016 Christine S. MacNeill

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by appli cable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var util = require('util');
var Queue = require('fastqueue');

function Valve (config) {
  var queue = new Queue;
  var wireCount = config.wires[0].length;
  var pending = config.wires[0];
  var node = this;
  var nodeStatus = "";
  var paused = null;
  function setStatus(fill, shape, text) {
    if (nodeStatus !== text) {
      node.status({ fill : fill, shape : shape, text: text});
      nodeStatus = text;
    }
  }
  setStatus('grey', 'ring', 'Initialising');
  var maxBuffer = 10;
  if (config.maxBuffer && typeof config.maxBuffer === 'string')
    config.maxBuffer = +config.maxBuffer;
  if (config.maxBuffer && config.maxBuffer > 0) maxBuffer = config.maxBuffer|0;

  var pull = function (id) {
    node.log(`Pull received with id ${id}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (pending.indexOf(id) < 0) pending.push(id);
    if ((queue.length > 0) && (pending.length === wireCount)) {
      pending = [];
      node.send({
        payload : queue.shift(),
        error : null,
        pull : pull
      });
    }
    if (paused && queue.length < 0.5 * maxBuffer) {
      node.log("Resuming.");
      var resumePull = paused;
      paused = null;
      resumePull(node.id);
    };
  };
  var push = function (err, val) {
    node.log(`Push received with value ${val}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (err) {
      node.send({
        payload : null,
        error : err,
        pull : pull
      });
    } else {
      if (queue.length <= maxBuffer) {
      //  node.log(queue);
        queue.push(val);
      } else {
        node.warn(`Dropping value ${val} from buffer as maximum length of ${maxBuffer} exceeded.`);
      }

      if (pending.length === wireCount) {
        var payload = queue.shift();
        node.log(`Sending ${payload} with pending ${JSON.stringify(pending)}.`);
        pending = [];
        node.send({
          payload : payload,
          error : null,
          pull : pull
        });
      };

      if (queue.length >= maxBuffer) {
        setStatus('red', 'dot', 'Overflow');
      } else if (queue.length >= 0.75 * maxBuffer) {
        setStatus('yellow', 'dot', '75% full');
      } else {
        setStatus('green', 'dot', 'Running');
      }
    }
  };
  var next = function (msg) {
    return function () {
      if (queue.length > 0.8 * maxBuffer) {
        paused = msg.pull;
        node.log("Pausing.");
      } else {
        msg.pull(node.id);
      };
    };
  };
  this.on('input', function(msg) {
    if (msg.error) {
      work(msg.error, null, push, next(msg));
    } else {
      work(null, msg.payload, push, next(msg));
    }
  });
  var work = function () {
    node.warn('Empty work function called.');
  };
  this.consume = function (cb) {
    work = cb;
    setStatus('green', 'dot', 'Running');
  }
  this.close = function (done) { // done is undefined :-(
    setStatus('yellow', 'ring', 'Closing');
    next = function () {
      setStatus('grey', 'ring', 'Closed');
    }
  }
}

module.exports = function (RED) {
  function AACDecode (config) {
    Valve.call(this, config);
    RED.nodes.createNode(this, config);
    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
      } else {
        push(null, "it's a " + x);
      }
      next();
    });
  }
  util.inherits(AACDecode, Valve);
  RED.nodes.registerType("aac-dec",AACDecode);
}
