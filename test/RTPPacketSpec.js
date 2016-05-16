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

var test = require('tape');
var RTPPacket = require('../model/RTPPacket.js');

var packetNoExtension = new Buffer([
  0x80, 0x60, 0x52, 0x84, 0x4a, 0x85, 0xf8, 0x89, 0x0f, 0x55, 0xa3, 0x9f, 0x9d, 0x74
]);

var packetWithExtension = new Buffer([
  0x90, 0x60, 0x52, 0x83, 0x4a, 0x85, 0xf8, 0x89, 0x0f, 0x55, 0xa3, 0x9f, 0xbe, 0xde,
  0x00, 0x13, 0x19, 0x00, 0x00, 0x56, 0x40, 0x63, 0xf4, 0x1c, 0x9c, 0x38, 0x00, 0x3f, 0x1c, 0xc7,
  0xca, 0xba, 0xda, 0xde, 0x4f, 0xb8, 0x9f, 0x71, 0x5d, 0xab, 0x4e, 0x37, 0xa2, 0x63, 0x4f, 0x45,
  0x69, 0xce, 0xa2, 0xab, 0x63, 0x4f, 0x97, 0x8d, 0xd1, 0xba, 0xd4, 0x66, 0x9e, 0xa5, 0xe4, 0x50,
  0xa0, 0x27, 0x00, 0x08, 0x04, 0x08, 0x03, 0x05, 0x0a, 0x02, 0x79, 0x00, 0x00, 0x56, 0x40, 0x63,
  0xf4, 0x1c, 0x9c, 0x38, 0x00, 0x97, 0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x61, 0xa8, 0x9d, 0x74
]);

test('An RTP packet with extensions', function (t) {
  var p = new RTPPacket(packetWithExtension);
  //console.log(JSON.stringify(p, null, 2));
  t.equal(p.getVersion(), 2, 'has the correct version.');
  t.equal(p.getPadding(), false, 'has no padding.');
  t.equal(p.getExtension(), true, 'has extensions.');
  t.equal(p.getCSRCCount(), 0, 'has a CSRC count of zero.');
  t.equal(p.getMarker(), false, 'has an unset marker.');
  t.equal(p.getPayloadType(), 96, 'has a payload type of 96.');
  t.equal(p.getSequenceNumber(), 21123, 'has sequence number 21124.');
  t.equal(p.getTimestamp(), 1250293897, 'has the expected timestamp.');
  t.equal(p.getSyncSourceID(), 0x0f55a39f, 'has the expected sync source ID.');
  t.deepEqual(p.getContributionSourceIDs(), [], 'has no contribution soruce IDs.');
  t.ok(typeof p.getExtensions() === 'object', 'has defined extensions.');
  t.deepEqual(p.getPayload(), new Buffer([0x9d, 0x74]), 'has the expected payload.');
  var x = p.getExtensions();

  t.equal(x.profile, 0xbede, 'is an RFC5285 one-byte header extension set.');
  t.equal(x.length, 19, 'extensions have the expected length.');
  function testExtValue(id, bytes) {
    t.ok(x['id' + id], 'extension ' + id + ' is defined.');
    t.ok(Buffer.isBuffer(x['id' + id]), 'extension ' + id + ' has a buffer value.');
    t.equal(x['id' + id].length, bytes.length, 'extension ' + id + ' has the ' +
        'correct length of ' + bytes.length + '.');
    t.deepEqual(x['id' + id], new Buffer(bytes), 'extension ' + id + ' has the ' +
        'expected bytes.');
  }
  testExtValue(1, [0x00, 0x00, 0x56, 0x40, 0x63, 0xf4, 0x1c, 0x9c, 0x38, 0x00]);
  testExtValue(3, [0x1c, 0xc7, 0xca, 0xba, 0xda, 0xde, 0x4f, 0xb8,
                   0x9f, 0x71, 0x5d, 0xab, 0x4e, 0x37, 0xa2, 0x63]);
  testExtValue(4, [0x45, 0x69, 0xce, 0xa2, 0xab, 0x63, 0x4f, 0x97,
                   0x8d, 0xd1, 0xba, 0xd4, 0x66, 0x9e, 0xa5, 0xe4]);
  testExtValue(5, [0xa0]);
  testExtValue(2, [0x00, 0x08, 0x04, 0x08, 0x03, 0x05, 0x0a, 0x02]);
  testExtValue(7, [0x00, 0x00, 0x56, 0x40, 0x63, 0xf4, 0x1c, 0x9c, 0x38, 0x00]);
  testExtValue(9, [0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x61, 0xa8]);
  t.equal(p.isStart(5), true, 'is marked as start.');
  t.end();
});

test('An RTP packet with no extensions', function (t) {
  var p = new RTPPacket(packetNoExtension);
  //console.log(JSON.stringify(p, null, 2));
  t.equal(p.getVersion(), 2, 'has the correct version.');
  t.equal(p.getPadding(), false, 'has no padding.');
  t.equal(p.getExtension(), false, 'has no extension.');
  t.equal(p.getCSRCCount(), 0, 'has a CSRC count of zero.');
  t.equal(p.getMarker(), false, 'has an unset marker.');
  t.equal(p.getPayloadType(), 96, 'has a payload type of 96.');
  t.equal(p.getSequenceNumber(), 21124, 'has sequence number 21124.');
  t.equal(p.getTimestamp(), 1250293897, 'has the expected timestamp.');
  t.equal(p.getSyncSourceID(), 0x0f55a39f, 'has the expected sync source ID.');
  t.deepEqual(p.getContributionSourceIDs(), [], 'has no contribution soruce IDs.');
  t.equal(p.getExtensions(), undefined, 'has undefined extensions.');
  t.deepEqual(p.getPayload(), new Buffer([0x9d, 0x74]), 'has the expected payload.');
  t.equal(p.isStart(5), false, 'is not marked as start.');
  t.end();
});

test('A default new RTP packet', function (t) {
  var p = new RTPPacket;
  t.equal(p.getVersion(), 2, 'has the correct version.');
  t.equal(p.getPadding(), false, 'has no padding.');
  t.equal(p.getExtension(), false, 'has no extension.');
  t.equal(p.getCSRCCount(), 0, 'has a CSRC count of zero.');
  t.equal(p.getMarker(), false, 'has an unset marker.');
  t.equal(p.getPayloadType(), 96, 'has a payload type of 96.');
  t.equal(p.getSequenceNumber(), 0, 'has zero sequence number.');
  t.equal(p.getTimestamp(), 0, 'has zero timestamp.');
  t.equal(p.getSyncSourceID(), 0, 'has zero sync source ID.');
  t.deepEqual(p.getContributionSourceIDs(), [], 'has no contribution soruce IDs.');
  t.equal(p.getExtensions(), undefined, 'has undefined extensions.');
  t.deepEqual(p.getPayload().length, 1500-12, 'has the expected payload size.');
  t.end();
});

test('Creating an RTP packet with extensions', function (t) {
  var p = new RTPPacket(1500);
  t.equal(p.setVersion(2), 2, 'can set the version.');
  t.equal(p.getVersion(), 2, 'has the correct version.');
  t.equal(p.setPadding(false), false, 'can set the padding.');
  t.equal(p.getPadding(), false, 'has no padding.');
  t.equal(p.setExtension(true), true, 'can set the extension.');
  t.equal(p.getExtension(), true, 'has extensions.');
  t.equal(p.setCSRCCount(0), 0, 'can set the CSRC count to 0.');
  t.equal(p.getCSRCCount(), 0, 'has a CSRC count of zero.');
  t.equal(p.setMarker(false), false, 'can set the marker to false.');
  t.equal(p.getMarker(), false, 'has an unset marker.');
  t.equal(p.setPayloadType(96), 96, 'can set the payload type.');
  t.equal(p.getPayloadType(), 96, 'has a payload type of 96.');
  t.equal(p.setSequenceNumber(21123), 21123, 'can set the sequence number.');
  t.equal(p.getSequenceNumber(), 21123, 'has sequence number 21124.');
  t.equal(p.setTimestamp(1250293897), 1250293897, 'can set the timestamp.');
  t.equal(p.getTimestamp(), 1250293897, 'has the expected timestamp.');
  t.equal(p.setSyncSourceID(0x0f55a39f), 0x0f55a39f, 'can set the sync source ID.');
  t.equal(p.getSyncSourceID(), 0x0f55a39f, 'has the expected sync source ID.');
  t.deepEqual(p.setContributionSourceIDs([]), [], 'can set empty CSRC IDs.');
  t.deepEqual(p.getContributionSourceIDs(), [], 'has no contribution soruce IDs.');

  t.deepEqual(p.buffer.slice(0, 12), packetWithExtension.slice(0, 12),
    'binary headers match per extension.');

  // TODO test extension code
  t.end();
});

test('Setting an array of CSRC values', function (t) {
  var p = new RTPPacket(1500);
  t.deepEqual(p.setContributionSourceIDs([12345, 54321, 424242]),
    [12345, 54321, 424242], 'can set some CSRC IDs.');
  t.equal(p.getCSRCCount(), 3, 'updates the CSRC count.');
  t.deepEqual(p.getContributionSourceIDs(), [12345, 54321, 424242],
    'stores the values as expected.');
  t.end();
});
