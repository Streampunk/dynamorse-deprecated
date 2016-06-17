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
var klv = require('kelvinadon');
var grainConcater = require('../../../valve/grainConcater.js');

module.exports = function (RED) {
  function MXFIn (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);

    // var base = H(res)
    // .through(klv.kelviniser())
    // .through(klv.metatiser())
    // .through(klv.stripTheFiller)
    // .through(klv.detailing())
    // .through(klv.puppeteer())
    // .through(klv.trackCacher());
  }
  util.inherits(MXFIn, redioactive.Funnel);
  RED.nodes.registerType("mxf-in", MXFIn);
}
