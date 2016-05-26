/* Copyright 2016 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing
  , software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var H = require('highland');
// var udpInlet = require('../valve/udpInlet.js');
var pcapInlet = require('../funnel/pcapInlet.js');
var udpSpigot = require('../spout/udpSpigot.js');
// var SDP = require('../model/SDP.js');
var dgram = require('dgram');

// var audioSDP = `v=0
// o=- 1443080730 1443080730 IN IP4 172.29.80.68
// s=IP Studio Stream
// t=0 0
// m=audio 5000 RTP/AVP 96
// c=IN IP4 232.226.253.166/32
// a=source-filter:incl IN IP4 232.226.253.166 172.29.80.68
// a=rtpmap:96 L24/48000/2
// a=control:trackID=1
// a=mediaclk:direct=1970351840 rate=48000
// a=extmap:1 urn:x-nmos:rtp-hdrext:origin-timestamp
// a=extmap:2 urn:ietf:params:rtp-hdrext:smpte-tc 1920@48000/25
// a=extmap:3 urn:x-nmos:rtp-hdrext:flow-id
// a=extmap:4 urn:x-nmos:rtp-hdrext:source-id
// a=extmap:5 urn:x-nmos:rtp-hdrext:grain-flags
// a=extmap:7 urn:x-nmos:rtp-hdrext:sync-timestamp
// a=extmap:9 urn:x-nmos:rtp-hdrext:grain-duration
// a=ts-refclk:ptp=IEEE1588-2008:ec-46-70-ff-fe-00-42-c4`

var mcastAddress = '228.0.0.4';
var netif = '192.168.0.12';
var port = 8000;

var pcapFile = '/Volumes/Ormiscraid/media/streampunk/examples/rtp-video-rfc4175-1080i50-sync.pcap';

var server = dgram.createSocket('udp4');

var udpSource = pcapInlet(pcapFile)
  .through(udpSpigot(server, mcastAddress, port, netif))
  .errors(function (e) { console.error(e); });

// var udpSync = udpInlet(server, mcastAddress, port, netif)
//   .errors(function (e) { console.error(e); });

// udpSync.each(H.log);
udpSource.doto(function (x) { if (x % 1000 === 0) console.log(x); }).done(server.close);
