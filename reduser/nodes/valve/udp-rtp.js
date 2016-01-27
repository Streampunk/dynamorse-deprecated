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

module.exports = function (RED) {
  function UDPtoRTP (config) {
    RED.nodes.createNode(this, config);
    var node = this;
    var waiting = true;
    var pendingMsg = null;
    var next = function () {
      if (pendingMsg) {
        pendingMsg.next = next;
        node.send(pendingMsg);
        pendingMsg = null;
        waiting = false;
      } else {
        waiting = true;
      }
    };
    node.on('input', function (msg) {
      // Transform message here
      if (waiting) {
        msg.next = next;
        node.send(msg);
        msg.next();
        pendngMsg = null;
        waiting = false;
      } else {
        pendingMsg = msg;
      }
    });
  }
  RED.nodes.registerType("udp-rtp",UDPtoRTP);
}
