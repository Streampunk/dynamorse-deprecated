/* Copyright 2016 Christine S. MacNeill

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

var util = require('util');
var fs = require('fs');
var redioactive = require('../../../util/Redioactive.js');
var H = require('highland');
var pcapInlet = require('../../../funnel/pcapInlet.js');
var udpToGrain = require('../../../valve/udpToGrain.js');
var grainConcater = require('../../../valve/grainConcater.js');
var SDP = require('../../../model/SDP.js');
var util = require('util');

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

var sdp = new SDP(videoSDP);
var srcBytesPerPixelPair = 5; // !!! rfc4175 pgroup !!!

module.exports = function (RED) {
  function PCAPReader (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);
    // Read SDP file / URL or check config
    // Create flow
    this.log(util.inspect(config));
    // this.highland(
    //   pcapInlet('/Users/vizigoth/Documents/streampunk/nmi/phase1/examples/rtp-video-rfc4175-1080i50-sync.pcap')
    //   .pipe(udpToGrain(sdp))
    //   .pipe(grainConcater(sdp.getWidth(0) * sdp.getHeight(0) * srcBytesPerPixelPair / 2)));
    this.on('close', this.close);
  }
  util.inherits(PCAPReader, redioactive.Funnel);
  RED.nodes.registerType("pcap-reader", PCAPReader);
}
