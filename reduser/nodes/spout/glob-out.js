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
var redioactive = require('../../../util/Redioactive.js')

function Spout (config) {
  var eachFn = function () { };
  var doneFn = function () { };
  var node = this;
  var nodeStatus = "";
  function setStatus(fill, shape, text) {
    if (nodeStatus !== text) {
      node.status({ fill : fill, shape : shape, text: text});
      nodeStatus = text;
    }
  }
  this.each = function (f) {
    eachFn = f;
    setStatus('green', 'dot', 'consuming');
  };
  this.done = function (f) {
    doneFn = f;
  };
  this.on('input', function (msg) {
    if (msg.error) {
      node.error(`Unhandled error ${msg.error.toString()}.`);
      doneFn = function () { }
      eachFn = null;
      setStatus('red', 'dot', 'error');
    } else if (redioactive.isEnd(msg.payload)) {
      setStatus('grey', 'ring', 'done');
      var execDone = doneFn;
      doneFn = function () { }
      eachFn = null;
      execDone();
    } else {
      if (eachFn) {
        eachFn(msg.payload);
        setTimeout(function () { msg.pull(node.id); }, 0);
      }
    }
  });
}

module.exports = function (RED) {
  function GlobOut (config) {
    Spout.call(this, config);
    RED.nodes.createNode(this, config);
    this.each(function (x) {
      this.log(`Received ${x}.`);
    }.bind(this));
    this.done(function () {
      this.log('Thank goodness that is over!');
    }.bind(this));
  }
  util.inherits(GlobOut, Spout);
  RED.nodes.registerType("glob-out",GlobOut);
}
