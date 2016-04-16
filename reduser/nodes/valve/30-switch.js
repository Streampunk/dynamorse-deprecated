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

var redioactive = require('../../../util/Redioactive.js');
var util = require('util');
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function Switch (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.active = (config.active === null || typeof config.active === "undefined") || config.active;
    var node = this;
    this.nmos_flow = null;

    this.consume(function (err, x, push, next) {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        push(null, x);
      } else {
        this.getNMOSFlow(x, function (err, f) {
          if (err) {
            this.warn("Failed to resolve NMOS flow: " + err);
            return push("Failed to resolve NMOS flow.");
          }
          this.nmos_flow = f;
          this.warn(util.inspect(this.nmos_flow));
        }.bind(this));

        if (Grain.isGrain(x)) {
          push(null, x);
          next();
        }
      }
    }.bind(this));
    this.on('close', this.close);
  }

  util.inherits(Switch, redioactive.Valve);
  RED.nodes.registerType("switch", Switch);

  RED.httpAdmin.post("/switch/:id/:state", RED.auth.needsPermission("switch.write"), function(req,res) {
    var node = RED.nodes.getNode(req.params.id);
    var state = req.params.state;
    if (node !== null && typeof node !== "undefined" ) {
      if (state === "enable") {
        node.active = true;
        res.sendStatus(200);
      } else if (state === "disable") {
        node.active = false;
        res.sendStatus(201);
      } else {
        res.sendStatus(404);
      }
    } else {
      res.sendStatus(404);
    }
  });
}
