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

var http = require('http');
var express = require("express");
var RED = require("node-red");
var fs = require('fs');
var dgram = require('dgram');
var ledger = require('nmos-ledger');
var util = require('util');

var hostname = require('os').hostname();
var shortHostname = hostname.match(/([^\.]*)\.?.*/)[1];
var pid = process.pid;

var properties = {
  redPort : '8000',
  ledgerPort : '3001',
  userDir : 'reduser'
};

var flowFileSet = false;

for ( var i = 2 ; i < process.argv.length ; i++ ) {
  var arg = /(\S+)=(\S+)/.exec(process.argv[i]);
  if (arg) properties[arg[1]] = arg[2];
  else console.error(`Could not process argument ${i - 1}: '${process.argv[i]}'`);
}

if (!properties.flowFile) {
  properties.flowFile = `flows_${hostname}_${properties.redPort}.json`;
}

if (isNaN(+properties.redPort) || +properties.redPort > 65535 ||
    properties.redPort < 0) {
  console.error('Parameter redPort must be a number between 0 and 65535.');
  process.exit(1);
}

if (isNaN(+properties.ledgerPort) || +properties.ledgerPort > 65535 ||
  +properties.ledgerPort < 0) {
  console.error('Parameter ledgerPort must be a number between 0 and 65535.');
  process.exit(1);
}

if (!properties.flowFile.endsWith('.json')) {
  console.error('Parameter flowFile must end with .json.');
  process.exit(1);
}

var node = new ledger.Node(null, null, `Dynamorse ${shortHostname} ${pid}`,
  `http://dynamorse-${shortHostname}-${pid}.local:${properties.nodePort}`,
  `${hostname}`);
// Externally advertised ... sources etc are registered with discovered registration
// services
var device = new ledger.Device(null, null, `device-${shortHostname}-${pid}`,
  ledger.deviceTypes.generic, node.id, null, null);
// Internal only ... sources etc are not pushed to external registration services
var pipelines = new ledger.Device(null, null, `pipelines-${shortHostname}-${pid}`,
  ledger.deviceTypes.pipeline, node.id, null, null);
var store = new ledger.NodeRAMStore(node);
var nodeAPI = new ledger.NodeAPI(+properties.ledgerPort, store);
nodeAPI.init().start();

// Fixed identifiers for global config nodes
var deviceNodeID = 'f089bf72.0f764';
var pipelinesNodeID = 'da7405b8.258bf8';
var selfNodeID = 'd8044477.27fbb8';
var extDefNodeID = '30fb5980.cf04a6';

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
    httpAdminRoot: "/red",
    httpNodeRoot: "/api",
    userDir: properties.userDir,
    flowFile: properties.flowFile,
    nodesDir: __dirname + "/reduser/nodes/",
    functionGlobalContext: {
      node : node,
      nodeAPI : nodeAPI,
      ledger : ledger,
      rtp_ext_id : extDefNodeID,
      pipelinesID : pipelines.id,
      genericID : device.id,
      updated : false
    },    // enables global context
    paletteCategories: ['subflows', 'funnel', 'valve', 'fitting', 'spout', 'testing', 'input', 'output', 'function', 'social', 'mobile', 'storage', 'analysis', 'advanced'],
    logging: { console : { level : "trace", audit : true } }
};

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI from /red
app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot, RED.httpNode);

server.listen(+properties.redPort);

// Start the runtime - function can be used to do work after types are loaded
RED.start().then(function () {
  RED.log.info("STARTED!");
});

// Run flow configurations once flows are loaded
var EE = require('events').EventEmitter;
var logger = new EE();
RED.log.addHandler(logger);
logger.on('log', function (x) { if (x.msg === 'Starting flows') {
  // logger.removeAllListeners();
  nodeAPI.putResource(device).catch(RED.log.error);
  nodeAPI.putResource(pipelines).then(function () {
    RED.log.info('Devices and self registred with ledger.');
    RED.settings.functionGlobalContext.updated = true;
    RED.nodes.updateFlow('global', {
      configs: [ {
        id: deviceNodeID,
        type: 'device',
        nmos_id: device.id,
        version: device.version,
        nmos_label: device.label,
        nmos_type: device.type,
        node_id: device.node_id,
        node_ref: selfNodeID
      }, {
        id: pipelinesNodeID,
        type: 'device',
        nmos_id: pipelines.id,
        version: pipelines.version,
        nmos_label: pipelines.label,
        nmos_type: pipelines.type,
        node_id: pipelines.node_id,
        node_ref: selfNodeID
      }, {
        id: selfNodeID,
        type: 'self',
        nmos_id: node.id,
        version: node.version,
        nmos_label: node.label,
        href: node.href,
        hostname: node.hostname,
        nodeAPI: nodeAPI
      }, {
        id : extDefNodeID,
        type : 'rtp-ext',
        name : 'rtp-extensions-default',
        origin_timestamp_id : 1,
        smpte_tc_id : 2,
        smpte_tc_param : '3600@90000/25',
        flow_id_id: 3,
        source_id_id : 4,
        grain_flags_id : 5,
        sync_timestamp_id : 7,
        grain_duration_id : 9,
        ts_refclk : 'ptp=IEEE1588-2008:dd-a9-3e-5d-c7-28-28-dc'
      } ],
      nodes: [] }
    )}
  ).then(function () {
    RED.log.info('Global flow updated with dynamorse configurations.');
    if (!RED.nodes.getFlows().some(function (x) {
      return x.label === 'Dynamorse'
    })) {
      RED.nodes.addFlow({
        label : 'Dynamorse',
        configs: [ ],
        nodes: [ {
          id : RED.util.generateId(),
          type: 'comment',
          name: 'Streampunk Media',
          info: 'Design and deploy professional media workflows with _Dynamorse_.',
          x: 122,
          y: 45,
          wires: []
        } ]
      });
    }
  }).then(
    function () { RED.log.info('Dynamorse tab checked and created if required.')},
    RED.log.error
  );
}} );

// Send process memory statistics to influxDB every couple of seconds
var hostname = require('os').hostname();
var pid = process.pid;
var soc = dgram.createSocket('udp4');

setInterval(function () {
  var usage = process.memoryUsage();
  var message = new Buffer(`remember,host=${hostname},pid=${pid},type=rss value=${usage.rss}\n` +
    `remember,host=${hostname},pid=${pid},type=heapTotal value=${usage.heapTotal}\n` +
    `remember,host=${hostname},pid=${pid},type=heapUsed value=${usage.heapUsed}`);
  soc.send(message, 0, message.length, 8765, '192.168.99.100');
}, 2000);
