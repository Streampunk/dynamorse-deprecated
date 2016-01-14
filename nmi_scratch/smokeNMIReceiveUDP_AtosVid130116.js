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

var audioSDP = `v=0
o=- 1443716955 1443716955 IN IP4 172.29.82.51
s=BNCS Node 2 Video
t=0 0
m=video 5002 RTP/AVP 96
c=IN IP4 232.121.83.121/32
a=source-filter:incl IN IP4 232.121.83.121 172.29.82.51
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
a=ts-refclk:ptp=IEEE1588-2008:ec-46-70-ff-fe-00-42-c4`


var mcastAddress = '232.113.33.205';
var netif = '192.168.15.140';
var port = 5000;

var pcapFile = '/Volumes/Ormiscraid/media/streampunk/examples/rtp-audio-l24-2chan.pcap';

var server = dgram.createSocket('udp4');

// var udpSource = pcapInlet(pcapFile)
//   .through(udpSpigot(server, mcastAddress, port, netif))
//   .errors(function (e) { console.error(e); });

var udpSync = udpInlet(server, mcastAddress, port, netif)
  .errors(function (e) { console.error(e); });

var count = 0;
udpSync.each(function () { console.log(count++); });
// udpSource.each(H.log);
