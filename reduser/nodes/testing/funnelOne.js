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
var redioactive = require('../../../util/Redioactive.js')

module.exports = function (RED) {
  function GlobIn (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);
    this.log(JSON.stringify(config, null, 2));
    this.count = 0;
    this.generator(function (push, next) {
      if (this.count < 100) {
        push(null, this.count++);
        setTimeout(next, 10);
      } else {
        push(null, redioactive.end);
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(GlobIn, redioactive.Funnel);
  RED.nodes.registerType("funnelOne",GlobIn);
};
