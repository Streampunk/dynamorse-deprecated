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

var Grain = require('../model/Grain.js');
var Timecode = require('../model/Timecode.js');
var uuid = require('uuid');
var test = require('tape');

test('A newly created grain from mainly strings', function (t) {
  var g = new Grain([new Buffer(10), new Buffer(5)],
    '12345:67890', '98765:43210', '10:11:12:13',
    'CCA06626-AEB1-4014-8287-BBEF45E7DD51',
    '0313B546-1325-4983-B80B-1C3C312FC181',
    '1/25');
  t.ok(Grain.isGrain(g), "creates a valid grain.");
  t.deepEqual(g.getDuration(), [1, 25], "has expected duration.");
  t.equal(uuid.unparse(g.flow_id), 'cca06626-aeb1-4014-8287-bbef45e7dd51',
    'has expected flow ID.');
  t.equal(uuid.unparse(g.source_id), '0313b546-1325-4983-b80b-1c3c312fc181',
    'has expected source ID.');
  t.equal(g.formatTimestamp(g.ptpSync), "12345:000067890",
    'has expected ptp sync timestamp.');
  t.equal(g.formatTimestamp(g.ptpOrigin), "98765:000043210",
    'has expected ptp origin timestamp.');
  t.equal(g.formatTimecode(g.timecode), "10:11:12:13",
    'has expected timecode.');
  t.deepEqual(g.buffers.map(function (x) { return x.length; }), [10, 5],
    'buffers have expected lengths.');
  t.end();
});
