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

var license = `/* Copyright 2016 Christine S. MacNeill

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

`;

var templates = {
  funnelJSTemplate : license +
`module.exports = function (RED) {
  function _NodeFunction_ (config) {
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
    });
  }
  RED.nodes.registerType("_NodeName_",_NodeFunction_);
}
`,
  funnelHTMLTemplate : license +
`<script type="text/javascript">
  RED.nodes.registerType('_NodeName_',{
    category: 'funnel',
    color: '#D8BFD8',
    defaults: {
      name: {value:""}
    },
    inputs:0,
    outputs:1,
    icon: "file.png",
    label: function() {
      return this.name ||  "_NodeName_";
    }
  });
</script>

<script type="text/x-red" data-template-name="_NodeName_">
  <div class="form-row">
    <label for="node-input-name"><i class="icon-tag"></i> Name</label>
    <input type="text" id="node-input-name" placeholder="Name">
  </div>
</script>

<script type="text/x-red" data-help-name="_NodeName_">
  <p>Description of _NodeName_.</p>
</script>
`,
  valveJSTemplate : license +
`module.exports = function (RED) {
  function _NodeFunction_ (config) {
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
  RED.nodes.registerType("_NodeName_",_NodeFunction_);
}
`,
  valveHTMLTemplate : license +
`<script type="text/javascript">
    RED.nodes.registerType('_NodeName_',{
      category: 'valve',
      color: '#87A980',
      defaults: {
        name: {value:""}
      },
      inputs:1,
      outputs:1,
      icon: "feed.png",
      label: function() {
        return this.name ||  "_NodeName_";
      }
    });
  </script>

  <script type="text/x-red" data-template-name="_NodeName_">
    <div class="form-row">
      <label for="node-input-name"><i class="icon-tag"></i> Name</label>
      <input type="text" id="node-input-name" placeholder="Name">
    </div>
  </script>

  <script type="text/x-red" data-help-name="_NodeName_">
    <p>Description of _NodeName_.</p>
  </script>
`,
  spoutJSTemplate : license +
`module.exports = function (RED) {
    function _NodeFunction_ (config) {
      RED.nodes.createNode(this, config);
      var node = this;
      var waiting = true;
      var lastMsg = null;
      node.on('input', function (msg) {
        // Transform message - perform action
        msg.next();
      });
    }
    RED.nodes.registerType("_NodeName_",_NodeFunction_);
  }
  `,
  spoutHTMLTemplate : license +
`<script type="text/javascript">
  RED.nodes.registerType('_NodeName_',{
    category: 'spout',
    color: '#E6E0F8',
    defaults: {
      name: {value:""}
    },
    inputs:1,
    outputs:0,
    align: 'right',
    icon: "bridge.png",
    label: function() {
      return this.name ||  "_NodeName_";
    }
  });
</script>

<script type="text/x-red" data-template-name="_NodeName_">
  <div class="form-row">
    <label for="node-input-name"><i class="icon-tag"></i> Name</label>
    <input type="text" id="node-input-name" placeholder="Name">
  </div>
</script>

<script type="text/x-red" data-help-name="_NodeName_">
  <p>Description of _NodeName_.</p>
</script>
`};

var fs = require('fs');

var nodeFunction = process.argv[2];
var nodeName = process.argv[3];
var nodeType = process.argv[4];

var jsFile = templates[nodeType + 'JSTemplate']
  .replace(/_NodeName_/g, nodeName)
  .replace(/_NodeFunction_/g, nodeFunction);
var htmlFile = templates[nodeType + 'HTMLTemplate']
  .replace(/_NodeName_/g, nodeName);

fs.writeFile('./reduser/nodes/' + nodeType + '/' + nodeName + '.js', jsFile, (err) => {
    if (err) throw err;
    console.log('JS for ' + nodeName + ' saved!');
});

fs.writeFile('./reduser/nodes/' + nodeType + '/' + nodeName + '.html', htmlFile, (err) => {
    if (err) throw err;
    console.log('HTML for ' + nodeName + ' saved!');
});
