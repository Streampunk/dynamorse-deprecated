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

function Spout (config) {
  var eachFn = function () { };
  var node = this;
  this.each = function (f) {
    eachFn = f;
  }
  this.on('input', function (msg) {
    setTimeout(function () {
      eachFn(msg.payload);
      msg.pull(node.id);
    }, 100);
  });
}

module.exports = function (RED) {
  function GlobOut (config) {
    Spout.call(this, config);
    RED.nodes.createNode(this, config);
    this.each(function (x) {
      this.log(`Received ${x}.`);
    }.bind(this));
  }
  util.inherits(GlobOut, Spout);
  RED.nodes.registerType("glob-out",GlobOut);
}
