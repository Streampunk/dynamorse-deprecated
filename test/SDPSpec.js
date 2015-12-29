/* Copyright 2015 Christine S. MacNeill

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

var SDP = require('../model/SDP.js');
var test = require('tape');

var audioSDP = `v=0
o=- 1443080730 1443080730 IN IP4 172.29.80.68
s=IP Studio Stream
t=0 0
m=audio 5000 RTP/AVP 96
c=IN IP4 232.226.253.166/32
a=source-filter:incl IN IP4 232.226.253.166 172.29.80.68
a=rtpmap:96 L24/48000/2
a=control:trackID=1
a=mediaclk:direct=1970351840 rate=48000
a=extmap:1 urn:x-ipstudio:rtp-hdrext:origin-timestamp
a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 1920@48000/25
a=extmap:3 urn:x-ipstudio:rtp-hdrext:flow-id
a=extmap:4 urn:x-ipstudio:rtp-hdrext:source-id
a=extmap:5 urn:x-ipstudio:rtp-hdrext:grain-flags
a=extmap:7 urn:x-ipstudio:rtp-hdrext:sync-timestamp
a=extmap:9 urn:x-ipstudio:rtp-hdrext:grain-duration
a=ts-refclk:ptp=IEEE1588-2008:ec-46-70-ff-fe-00-42-c4`;

test('An audio SDP file is parsed', function (t) {
  var sdp = new SDP(audioSDP);
  // console.log(JSON.stringify(sdp, null, 2));
  t.deepEqual(sdp.getMediaHeaders(), [ 'audio 5000 RTP/AVP 96'] );
  t.equal(sdp.getExtMapReverse(0)['urn:ietf:params:rtp-hdrext:smpte-tc'], 2,
    'and does a correct reverse lookup on extmap.');
  t.equal(sdp.toString().trim(), audioSDP, 'and roundtrips.');
  t.equal(sdp.getEncodingName(0), 'L24', 'retrieves correct encoding name.');
  t.end();
});

var videoSDP = `v=0
o=- 1443716955 1443716955 IN IP4 172.29.82.50
s=IP Studio Stream
t=0 0
m=video 5000 RTP/AVP 96
c=IN IP4 232.121.83.127/32
a=source-filter:incl IN IP4 232.121.83.127 172.29.82.50
a=rtpmap:96 raw/90000
a=fmtp:96 sampling=YCbCr-4:2:2; width=1920; height=1080; depth=10; colorimetry=BT709-2; interlace=1
a=mediaclk:direct=1119082333 rate=90000
a=extmap:1 urn:x-ipstudio:rtp-hdrext:origin-timestamp
a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 3600@90000/25
a=extmap:3 urn:x-ipstudio:rtp-hdrext:flow-id
a=extmap:4 urn:x-ipstudio:rtp-hdrext:source-id
a=extmap:5 urn:x-ipstudio:rtp-hdrext:grain-flags
a=extmap:7 urn:x-ipstudio:rtp-hdrext:sync-timestamp
a=extmap:9 urn:x-ipstudio:rtp-hdrext:grain-duration
a=ts-refclk:ptp=IEEE1588-2008:ec-46-70-ff-fe-00-42-c4`;

test('A video SDP file is parsed', function(t) {
  var sdp = new SDP(videoSDP);
  // console.log(JSON.stringify(sdp, null, 2));
  t.deepEqual(sdp.getMediaHeaders(), [ 'video 5000 RTP/AVP 96' ],
    'has correct media headers');
  t.equal(sdp.getExtMapReverse(0)['urn:x-ipstudio:rtp-hdrext:sync-timestamp'],
    7, 'does a correct reverse lookup on ext map.');
  t.equal(sdp.toString().trim(), videoSDP, 'and roundtrips.');
  t.equal(sdp.getEncodingName(0), 'raw', 'retrieves correct encoding name.');
  t.end();
});

var mixedSDP = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=IP Studio AVCI RTP Test Stream
c=IN IP4 239.255.1.1
t=0 0
a=tool:sbrtp_send
m=video 5004 RTP/AVP 98
a=rtpmap:98 H264/90000
a=fmtp:98 profile-level-id=7a1029;packetization-mode=1
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0
a=mediaclk:direct=1909987554
a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 3600@90000/25
a=extmap:7 urn:x-ipstudio:rtp-hdrext:sync-timestamp
a=extmap:8 urn:x-ipstudio:rtp-hdrext:origin-timestamp
a=extmap:9 urn:x-ipstudio:rtp-hdrext:flow-id
a=extmap:10 urn:x-ipstudio:rtp-hdrext:source-id
a=extmap:11 urn:x-ipstudio:rtp-hdrext:grain-flags
a=extmap:12 urn:x-ipstudio:rtp-hdrext:grain-duration
m=audio 5006 RTP/AVP 99
i=Channels 1-2
a=rtpmap:99 L16/48000/2
a=ts-refclk:ptp=IEEE1588-2008:39-A7-94-FF-FE-07-CB-D0
a=mediaclk:direct=1985293029
a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 1920@48000/25
a=extmap:7 urn:x-ipstudio:rtp-hdrext:sync-timestamp
a=extmap:8 urn:x-ipstudio:rtp-hdrext:origin-timestamp
a=extmap:9 urn:x-ipstudio:rtp-hdrext:flow-id
a=extmap:10 urn:x-ipstudio:rtp-hdrext:source-id
a=extmap:11 urn:x-ipstudio:rtp-hdrext:grain-flags
a=extmap:12 urn:x-ipstudio:rtp-hdrext:grain-duration`;

test('A mixed SDP file is parsed', function (t) {
  var sdp = new SDP(mixedSDP);
  t.deepEqual(sdp.getMediaHeaders(),
    [ 'video 5004 RTP/AVP 98', 'audio 5006 RTP/AVP 99' ],
    'has expected media headers.');
  t.equal(sdp.getExtMapReverse(1)['urn:x-ipstudio:rtp-hdrext:grain-flags'],
    11, 'does a correct reverse lookup on ext map.');
  t.equal(sdp.toString().trim(), mixedSDP, 'and roundtrips.');
  t.equal(sdp.getEncodingName(0), 'H264', 'has expected encoding name for video.');
  t.equal(sdp.getEncodingName(1), 'L16', 'has expected encoding name for audio.');
  t.end();
});
