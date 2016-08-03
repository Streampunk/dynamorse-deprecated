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

var util = require('util');
var redioactive = require('../../../util/Redioactive.js')
var Grain = require('../../../model/Grain.js');
var Promise = require('promise');
var SDPProcessing = require('../../../util/SDPProcessing.js');

module.exports = function (RED) {
  function FunnelOne (config) {
    RED.nodes.createNode(this,config);
    redioactive.Funnel.call(this, config);
    if (!this.context().global.get('updated'))
      return this.log(`Waiting for global context updated. ${this.context().global.get('updated')}`);
    var node = this;

    this.count = +config.start;
    this.log(JSON.stringify(this.context().global.get('node')));
    this.generator(function (push, next) {
      if (this.count <= +config.end) {
        push(null, this.count++);
        setTimeout(next, +config.delay);
      } else {
        if (config.repeat) {
          this.count = config.start;
          push(null, this.count++);
          setTimeout(next, +config.delay);
        } else {
          push(null, redioactive.end);
        }
      }
    }.bind(this));
    this.on('close', this.close);
  }
  util.inherits(FunnelOne, redioactive.Funnel);
  RED.nodes.registerType("funnel one", FunnelOne);

  FunnelOne.prototype.sdpToTags = SDPProcessing.sdpToTags;
  FunnelOne.prototype.setTag = SDPProcessing.setTag;
  FunnelOne.prototype.sdpURLReader = Promise.denodeify(SDPProcessing.sdpURLReader);
  FunnelOne.prototype.sdpToExt = SDPProcessing.sdpToExt;
};
