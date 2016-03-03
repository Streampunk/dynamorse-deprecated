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

// Reactive streams library for Node-RED nodes.

var Queue = require('fastqueue');
var dgram = require('dgram');
var util = require('util');

var hostname = require('os').hostname();
var pid = process.pid;

function End() { }

End.prototype.toString = function () { return 'End'; };
var isEnd = function (x) {
  return x !== null &&
    typeof x === 'object' &&
    x.constructor === End.prototype.constructor;
}
var theEnd = new End;

var setStatus = function (fill, shape, text) {
  if (this.nodeStatus !== text && this.nodeStatus !== 'done') {
    this.status({ fill : fill, shape : shape, text: text});
    this.nodeStatus = text;
  }
}

var soc = dgram.createSocket('udp4');
var nodeCount = 0;

function safeStatString (s) {
  console.log('+++', s);
  return s.replace(/\W/g, '_');
}

function Funnel (config) {
  var queue = new Queue;
  var wireCount = config.wires[0].length;
  var pending = config.wires[0];
  var node = this;
  this.nodeStatus = "";
  this.setStatus = setStatus.bind(this);
  var workTimes = [];
  var paused = false;
  var soc = dgram.createSocket('udp4');
  console.log('***', util.inspect(this.setStatus, {showHidden: true}));
  node.setStatus('grey', 'ring', 'initialising');
  var maxBuffer = 10;
  if (config.maxBuffer && typeof config.maxBuffer === 'string')
    config.maxBuffer = +config.maxBuffer;
  if (config.maxBuffer && typeof config.maxBuffer === 'number' && config.maxBuffer > 0)
    maxBuffer = config.maxBuffer|0;

  var pull = function (id) {
    node.log(`Pull received with id ${id}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (pending.indexOf(id) < 0) pending.push(id);
    if ((queue.length > 0) && (pending.length === wireCount)) {
      pending = [];
      var payload = queue.shift();
      var message = new Buffer(`punkd value=${payload}`)
      soc.send(message, 0, message.length, 8765);
      if (isEnd(payload)) {
        work = function () { }
        next = function () {
          node.setStatus('grey', 'ring', 'done');
        };
        node.setStatus('grey', 'ring', 'done');
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
    setImmediate(function () { if (err) {
      node.log(`Push received with value ${val}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
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
        if (isEnd(payload)) {
          work = function () { }
          next = function () {
            node.setStatus('grey', 'ring', 'done');
          };
          node.setStatus('grey', 'ring', 'done');
        };
        node.send({
          payload : payload,
          error : null,
          pull : pull
        });
      };

      if (queue.length >= maxBuffer) {
        node.setStatus('red', 'dot', 'overflow');
      } else if (queue.length >= 0.75 * maxBuffer) {
        node.setStatus('yellow', 'dot', '75% full');
      } else {
        node.setStatus('green', 'dot', 'generating');
      }
    } });
  };
  var workStart = null;
  var next = function () {
    if (workStart) { workTimes.push(process.hrtime(workStart)); }
    setImmediate(function () {
      if (queue.length < 0.8 * maxBuffer) {
        workStart = process.hrtime();
        work(push, next);
      } else {
        paused = true;
        node.log("Pausing.");
      }
    });
  };
  var work = function () { };
  this.generator = function (cb) {
    work = cb;
    node.setStatus('green', 'dot', 'generating');
    next();
  }
  this.close = function (done) { // done is undefined :-(
    node.setStatus('yellow', 'ring', 'closing');
    next = function () {
      node.setStatus('grey', 'ring', 'closed');
    }
  }
  var configName = safeStatString(node.type + (nodeCount++));
  var nodeType = safeStatString(node.type);
  // Send stats every second
  setInterval(function () {
    var measuredTimes = workTimes;
    workTimes = [];
    var sum = measuredTimes.reduce(function (prev, curr) {
      return prev + curr[0] * 1000000000 + curr[1]; }, 0);
    var average = (measuredTimes.length === 0) ? 0 : sum / measuredTimes.length|0;
    var message = new Buffer(
      `grainFlow,host=${hostname},pid=${pid},redioType=funnel,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${measuredTimes.length}\n` +
      `nodeWorkAvg,host=${hostname},pid=${pid},redioType=funnel,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${average}\n` +
      `bufferLength,host=${hostname},pid=${pid},redioType=funnel,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${queue.length}`);
    // console.log('Sending stats', message.toString());
    soc.send(message, 0, message.length, 8765);
  }, 1000);
}

function Valve (config) {
  var queue = new Queue;
  var wireCount = config.wires[0].length;
  var pending = config.wires[0];
  var node = this;
  this.nodeStatus = "";
  this.setStatus = setStatus.bind(this);
  var workTimes = [];
  var paused = [];
  node.setStatus('grey', 'ring', 'initialising');
  var maxBuffer = 10;
  if (config.maxBuffer && typeof config.maxBuffer === 'string')
    config.maxBuffer = +config.maxBuffer;
  if (config.maxBuffer && typeof config.maxBuffer === 'number' && config.maxBuffer > 0)
    maxBuffer = config.maxBuffer|0;

  var pull = function (id) {
    node.log(`Pull received with id ${id}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (pending.indexOf(id) < 0) pending.push(id);
    if ((queue.length > 0) && (pending.length === wireCount)) {
      pending = [];
      var payload = queue.shift();
      if (isEnd(payload)) {
        work = function () { }
        next = function () {
          node.setStatus('grey', 'ring', 'done');
        };
        node.setStatus('grey', 'ring', 'done');
      };
      node.send({
        payload : payload,
        error : null,
        pull : pull
      });
    }
    if (paused.length > 0 && queue.length < 0.5 * maxBuffer) {
      node.log("Resuming.");
      var resumePull = paused;
      paused = [];
      resumePull.forEach(function (p) {
        setImmediate(function() { p(node.id); }); });
    };
  };
  var push = function (err, val) {
    node.log(`Push received with value ${val}, queue length ${queue.length}, pending ${JSON.stringify(pending)}`);
    if (err) {
      node.setStatus('red', 'dot', 'error');
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
        if (isEnd(payload)) {
          work = function () { }
          next = function () {
            node.setStatus('grey', 'ring', 'done');
          };
          node.setStatus('grey', 'ring', 'done');
        };
        node.send({
          payload : payload,
          error : null,
          pull : pull
        });
      };

      if (queue.length > maxBuffer) {
        node.setStatus('red', 'dot', 'overflow');
        node.warn(`Queue length ${queue.length}`);
      } else if (queue.length >= 0.75 * maxBuffer) {
        node.setStatus('yellow', 'dot', '75% full');
      } else {
        node.setStatus('green', 'dot', 'running');
      }
    }
  };
  var next = function (msg) {
    var startTime = process.hrtime();
    if (isEnd(msg.payload))
      return function () { }
    return function () {
      workTimes.push(process.hrtime(startTime));
      if (queue.length > 0.8 * maxBuffer) {
        paused.push(msg.pull);
        node.log("Pausing.");
      } else {
        setImmediate(function () { msg.pull(node.id) });
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
    node.setStatus('green', 'dot', 'running');
  }
  this.close = function (done) { // done is undefined :-(
    node.setStatus('yellow', 'ring', 'closing');
    next = function () {
      node.setStatus('grey', 'ring', 'closed');
    }
  }
  var configName = safeStatString(node.type + (nodeCount++));
  var nodeType = safeStatString(node.type);
  // Send stats every second
  setInterval(function () {
    var measuredTimes = workTimes;
    workTimes = [];
    var sum = measuredTimes.reduce(function (prev, curr) {
      return prev + curr[0] * 1000000000 + curr[1]; }, 0);
    var average = (measuredTimes.length === 0) ? 0 : sum / measuredTimes.length|0;
    var message = new Buffer(
      `grainFlow,host=${hostname},pid=${pid},redioType=valve,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${measuredTimes.length}\n` +
      `nodeWorkAvg,host=${hostname},pid=${pid},redioType=valve,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${average}\n` +
      `bufferLength,host=${hostname},pid=${pid},redioType=valve,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${queue.length}\n`);
    // console.log('Sending stats', message.toString());
    soc.send(message, 0, message.length, 8765);
  }, 1000);
}

function Spout (config) {
  var eachFn = null;
  var doneFn = function () { };
  var node = this;
  this.nodeStatus = "";
  this.setStatus = setStatus.bind(this);
  node.setStatus('grey', 'ring', 'initialising');
  var workTimes = [];
  this.each = function (f) {
    eachFn = f;
    node.setStatus('green', 'dot', 'consuming');
  };
  this.done = function (f) {
    doneFn = f;
  };
  var next = function (msg) {
    var startTime = process.hrtime();
    return function () {
      workTimes.push(process.hrtime(startTime));
      setImmediate(function () { msg.pull(node.id); });
    };
  };
  this.on('input', function (msg) {
    if (msg.error) {
      node.error(`Unhandled error ${msg.error.toString()}.`);
      doneFn = function () { }
      eachFn = null;
      node.setStatus('red', 'dot', 'error');
    } else if (isEnd(msg.payload)) {
      node.setStatus('grey', 'ring', 'done');
      var execDone = doneFn;
      doneFn = function () { }
      eachFn = null;
      execDone();
    } else {
      if (eachFn) {
        eachFn(msg.payload, next(msg));
      }
    }
  });

  var configName = safeStatString(node.type + (nodeCount++));
  var nodeType = safeStatString(node.type);
  // Send stats every second
  setInterval(function () {
    var measuredTimes = workTimes;
    workTimes = [];
    var sum = measuredTimes.reduce(function (prev, curr) {
      return prev + curr[0] * 1000000000 + curr[1]; }, 0);
    var average = (measuredTimes.length === 0) ? 0 : sum / measuredTimes.length|0;
    var message = new Buffer(
      `grainFlow,host=${hostname},pid=${pid},redioType=spout,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${measuredTimes.length}\n` +
      `nodeWorkAvg,host=${hostname},pid=${pid},redioType=spout,nodeType=${nodeType},nodeName=${configName},nodeID=${node.id} value=${average}`);
    // console.log('Sending stats', message.toString());
    soc.send(message, 0, message.length, 8765);
  }, 1000);
}

module.exports = {
  Funnel : Funnel,
  Valve : Valve,
  Spout : Spout,
  end : theEnd,
  isEnd : isEnd
};
