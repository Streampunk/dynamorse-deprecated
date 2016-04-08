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
var redioactive = require('../../../util/Redioactive.js');

module.exports = function (RED) {
  function ValveOne (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.nmos_flow = null;
    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (x === redioactive.end) {
        push(null, redioactive.end);
      } else {
        if (!this.nmos_flow) {
          this.getNMOSFlow(x, function (err, f) {
            if (err) return push("Failed to resolve NMOS flow.");
            this.nmos_flow = f;
            this.log(util.inspect(this.nmos_flow));
            push(null, "it's a " + x);
            next();
          }.bind(this));
        } else {
          push(/* x === 50 ? new Error('cock') : */ null, "it's a " + x);
          next();
        }
      }

    }.bind(this));
  }
  util.inherits(ValveOne, redioactive.Valve);
  RED.nodes.registerType("valveOne", ValveOne);
}
