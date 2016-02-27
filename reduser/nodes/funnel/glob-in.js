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
  function GlobIn (config) {
    RED.nodes.createNode(this,config);
    var node = this;
    var count = 0;
    var next = function () {
      var msg = {
        payload : count++,
        next : next
      };
      node.send(msg);
    };
    setImmediate(function() {
      next();
      this.status({fill : "grey", shape : "ring", text : "Initialising"});
    }.bind(this));
    setTimeout(function () {
      this.status({fill : "green", shape : "dot", text : "Reading"});
    }.bind(this), 2000);
    setTimeout(function () {
      if (Math.random() > 0.3)
        this.status({fill : "blue", shape : "dot", text : "Completed"});
      else
        this.status({fill : "red", shape : "dot", text : "Failed"});
    }.bind(this), 5000);
  }
  RED.nodes.registerType("glob-in",GlobIn);
}
