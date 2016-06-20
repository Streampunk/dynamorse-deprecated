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
var Grain = require('../../../model/Grain.js');

module.exports = function (RED) {
  function SpmHTTPOut (config) {
    RED.nodes.createNode(this, config);
    redioactive.Spout.call(this, config);
    var node = this;
    var srcFlow = null;
    this.on('error', function (err) {
      node.warn(`Error transporting flow over HTTP '${config.path}': ${err}`)
    });
    var grainCache = [];
    config.path = (config.path.endsWith('/')) ? config.path.slice(-1) : config.path;
    this.each(function (x, next) {
      if (Grain.isGrain(x)) {
        grainCache.push(x);
        if (grainCache.length > config.cacheSize) grainCache = grainCache.slice(1);
        next();
      } else {
        node.warn(`HTTP out received something that is not a grain.`);
        next();
      }
    });
    if (config.mode === 'pull') {
      var app = express();
      app.use(bodyParser.raw({ limit : config.payloadLimit || 6000000 }));
      app.get(config.path + "/:ts", function (req, res) {

      });
    } else {
      // TODO implement push mode
    }

  }
  util.inherits(SpmHTTPOut, redioactive.Spout);
  RED.nodes.registerType("spm-http-out", SpmHTTPOut);
}
