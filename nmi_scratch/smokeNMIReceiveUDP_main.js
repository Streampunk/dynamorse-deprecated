/* Copyright 2015 Christine S. MacNeill

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by appli cable law or agreed to in writing
  , software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var H = require('highland');
var udpInlet = require('../funnel/udpInlet.js');
var pcapInlet = require('../funnel/pcapInlet.js');
var udpSpigot = require('../spout/udpSpigot.js');

var SDP = require('../model/SDP.js');
var dgram = require('dgram');

var videoSDP = `v=0
o=- 1452527308 1452527308 IN IP4 192.168.15.50
s=IP Studio Stream
t=0 0
m=video 5000 RTP/AVP 103
c=IN IP4 232.26.187.26/32
a=source-filter:incl IN IP4 232.26.187.26 192.168.15.50
a=rtpmap:103 raw/90000
a=fmtp:103 sampling=YCbCr-4:2:2; width=1920; height=1080; depth=10; interlace=1; colorimetry=BT709-2
a=mediaclk:direct=706968530 rate=90000
a=extmap:1 urn:x-ipstudio:rtp-hdrext:origin-timestamp
a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 3600@90000/25
a=extmap:3 urn:x-ipstudio:rtp-hdrext:flow-id
a=extmap:4 urn:x-ipstudio:rtp-hdrext:source-id
a=extmap:5 urn:x-ipstudio:rtp-hdrext:grain-flags
a=extmap:7 urn:x-ipstudio:rtp-hdrext:sync-timestamp
a=extmap:9 urn:x-ipstudio:rtp-hdrext:grain-duration
a=ts-refclk:ptp=IEEE1588-2008:ec-46-70-ff-fe-00-51-83`

var mcastAddress = '224.1.1.1';
var netif = '169.254.113.221';
var port = 8000;

var pcapFile = '/Volumes/Ormiscraid/media/streampunk/examples/rtp-audio-l24-2chan.pcap';

var server = dgram.createSocket('udp4');

var sdp = new SDP(videoSDP);

// var udpSource = pcapInlet(pcapFile)
//   .through(udpSpigot(server, mcastAddress, port, netif))
//   .errors(function (e) { console.error(e); });

var udpSync = udpInlet(server, mcastAddress, port, netif)
  .doto(H.log)
  .updToGrain(sdp)
  .errors(function (e) { console.error(e); });

var count = 0;
udpSync.each(function (x) { console.log(JSON.stringify(x, null, 2)); });
// udpSource.each(H.log);
