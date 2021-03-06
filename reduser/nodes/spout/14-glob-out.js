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

module.exports = function (RED) {
  function GlobOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    this.each(function (x, next) {
      this.log(`Received ${JSON.stringify(x, null, 2)}.`);
      // RED.comms.publish('debug', { msg: JSON.stringify(x, null, 2) });
      next();
    }.bind(this));
    this.done(function () {
      this.log('Thank goodness that is over!');
    }.bind(this));
    this.errors(function (err, next) {
      this.log(`Received error ${err.toString()}.`);
      next();
    }.bind(this));
  }
  util.inherits(GlobOut, redioactive.Spout);
  RED.nodes.registerType("glob-out", GlobOut);
}
