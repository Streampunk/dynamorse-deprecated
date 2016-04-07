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

module.exports = function(RED) {
  function Self (config) {
    RED.nodes.createNode(this, config);
    var node = this;
    var store = RED.settings.functionGlobalContext.nodeAPI.getStore();
    store.getSelf(function (err, self) {
      this.nmos_id = self.id;
      this.version = self.version;
      this.nmos_label = (config.nmos_label) ? config.nmos_label : self.label;
      this.href = (config.href) ? config.href : self.href;
      this.hostname = (config.hostname) ? config.hostname : self.hostname;
      var updatedSelf = new (RED.settings.functionGlobalContext).ledger.Node(
        self.id, null, this.nmos_label,
        this.href, this.hostname, self.caps, self.services);
      store.putSelf(updatedSelf, function (err, stored, deltaStore) {
        if (err) return node.warn("Failed to store replacement self.");
        node.version = stored.version;
        RED.settings.functionGlobalContext.nodeAPI.setStore(deltaStore);
      });
    });
  }
  RED.nodes.registerType("self", Self);
}
