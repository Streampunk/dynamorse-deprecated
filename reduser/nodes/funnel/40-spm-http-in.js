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

var redioactive = require('../../../util/Redioactive.js');
var util = require('util');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var fs = require('fs');

module.exports = function (RED) {
  function SpmHTTPIn (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);

    // var protocol = (config.protocol === 'HTTP') ? http : https;
    //
    // var runNext = function (x) {
    //   protocol.get(
    //     `${config.pullUrl}${(config.pullUrl.endsWith('/') ? '' : '/')}${config.path}`,
    //     function (res) {
    //       var count = 0;
    //       res.on('data', function (data) {
    //         count++; // Concatenate to buffer
    //       });
    //       res.on('end', function () {
    //         total++;
    //         tally += process.hrtime(startTime)[1]/1000000;
    //         console.log("No more data!", tally / total, total, x, count);
    //         runNext.call(this, x);
    //       });
    //     }).on('error', (e) => {
    //       this.warn(`Received error when requesting frame from server on thread ${x}: ${e}`)
    //     });
    //   }
    // };
    //
    // if (config.mode === 'push') {
    //   var app = express();
    //   app.use(bodyParser.raw({ limit : config.payloadLimit || 6000000 }));
    //
    //   app.post(config.path, function (req, res) {
    //     console.log(pushCount++, process.hrtime(startTime), req.body.length);
    //     res.json({ length : req.body.length }); // Need to add back pressure concept
    //   });
    //
    //   var server = protocol.createServer((config.protocol === 'HTTP') ? {} : {
    //     key : fs.readFileSync('./certs/dynamorse-key.pem'),
    //     cert : fs.readFileSync('./certs/dynamorse-cert.pem')
    //   }, app).listen(config.port);
    //   server.on('listening', function () {
    //     this.log(`Dynamorse ${config.protocol} server listening on port ${config.port}.`);
    //   });
    // } else { // config.mode is set to pull
    //   for ( var x = 0 ; x < config.threads ; x++ ) { // Number of parallel requests
    //     runNext.call(this, x);
    //   }
    // }
  }
  util.inherits(SpmHTTPIn, redioactive.Funnel);
  RED.nodes.registerType("spm-http-in", SpmHTTPIn);
}
