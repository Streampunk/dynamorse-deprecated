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

var macIn = require('../valve/macadamInlet.js');
var macadam = require('../../macadam')
var fs = require('fs');
var count = 0;
var ws = fs.createWriteStream('/Volumes/Ormiscraid/media/streampunk/recordings/fire100f.v210.yuv');
var stopper = null;
var w = macIn(0, macadam.bmdModeHD1080i50, macadam.bmdFormat10BitYUV, function (s) { stopper = s; })
  .take(100)
  .doto( function (x) {
    ws.write(x, function (err) {
      if (err) throw err;
      console.log('Written', count++);
    });
  })
  .errors(function (e) { console.log(e); })
  .done(function () { stopper(); ws.close() });
