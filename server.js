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

var http = require('http');
var express = require("express");
var RED = require("node-red");
var fs = require('fs');
var dgram = require('dgram');
var ledger = require('nmos-ledger');

var hostname = require('os').hostname();
var shortHostname = hostname.match(/([^\.]*)\.?.*/)[1];
var pid = process.pid;

var node = new ledger.Node(null, null, `Dynamorse ${shortHostname} ${pid}`,
  `http://dynamorse-${shortHostname}-${pid}.local:3001`,
  `${hostname}`);
var device = new ledger.Device(null, null, `${shortHostname}-${pid}-device`,
  null, node.id, null, null);
var store = new ledger.NodeRAMStore(node);
var nodeAPI = new ledger.NodeAPI(3001, store);
nodeAPI.init().start();

nodeAPI.getStore().putDevice(device, function (err, dev, deltaStore) {
  nodeAPI.setStore(deltaStore);
});

// Create an Express app
var app = express();

// Add a simple route for static content served from 'public'
app.use("/",express.static("public"));

// Create a server
var server = http.createServer(app);

// Debug levels
// Level of logging to be recorded. Options are:
            // fatal - only those errors which make the application unusable should be recorded
            // error - record errors which are deemed fatal for a particular request + fatal errors
            // warn - record problems which are non fatal + errors + fatal errors
            // info - record information about the general running of the application + warn + error + fatal errors
            // debug - record information which is more verbose than info + info + warn + error + fatal errors
            // trace - record very detailed logging + debug + info + warn + error + fatal errors

// Create the settings object - see default settings.js file for other options
var settings = {
    httpAdminRoot:"/red",
    httpNodeRoot: "/api",
    userDir:"reduser",
    nodesDir: process.cwd() + "/reduser/nodes/",
    functionGlobalContext: {
      node : node,
      nodeAPI : nodeAPI,
      ledger : ledger
    },    // enables global context
    paletteCategories: ['subflows', 'funnel', 'valve', 'spout', 'testing', 'input', 'output', 'function', 'social', 'mobile', 'storage', 'analysis', 'advanced'],
    logging: { console : { level : "trace", audit : true } }
};

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI from /red
app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot, RED.httpNode);

server.listen(8000);

// Start the runtime
RED.start();

// Send process memory statistics to influxDB every couple of seconds
var hostname = require('os').hostname();
var pid = process.pid;
var soc = dgram.createSocket('udp4');

setInterval(function () {
  var usage = process.memoryUsage();
  var message = new Buffer(`remember,host=${hostname},pid=${pid},type=rss value=${usage.rss}\n` +
    `remember,host=${hostname},pid=${pid},type=heapTotal value=${usage.heapTotal}\n` +
    `remember,host=${hostname},pid=${pid},type=heapUsed value=${usage.heapUsed}`);
  soc.send(message, 0, message.length, 8765);
}, 2000);

var redNodeID = RED.util.generateId();

setTimeout(function () {
  if (!RED.nodes.getFlows().some(function (x) {
    return x.label === 'Dynamorse'
  })) {
    RED.nodes.addFlow({
      label : 'Dynamorse',
      configs: [ {
        id: RED.util.generateId(),
        type: 'device',
        nmos_id: device.id,
        version: device.version,
        nmos_label: device.label,
        nmos_type: device.type,
        node_id: device.node_id,
        node_ref: redNodeID
      }, {
        id: redNodeID,
        type: 'self',
        nmos_id: node.id,
        version: node.version,
        nmos_label: node.label,
        href: node.href,
        hostname: node.hostname
      } ],
      nodes: [ {
        id : RED.util.generateId(),
        type: 'comment',
        name: 'Streampunk Media',
        info: 'Design professional media workflows with _Dynamorse_.',
        x: 122,
        y: 45,
        wires: []
      }]
    });
  }
  RED.nodes.getFlows().forEach(function (x) {
    console.log(x);
  });
}, 2000);
