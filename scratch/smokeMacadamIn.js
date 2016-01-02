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
var ws = fs.createWriteStream('/Volumes/Ormiscraid/media/streampunk/recordings/fire60.v210');
macIn(0, macadam.bmdModeHD1080i50, macadam.bmdFormat10BitYUV)
  .take(25*60)
  .each( function (x) {
    ws.write(x, function (err) {
      console.log('Written', count++);
      if (count === 25*60) ws.end(function () { console.log('Closed.'); });
    });
  });
