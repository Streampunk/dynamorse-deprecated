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

var netadon = require('../../netadon');
var pcapInlet = require('../funnel/pcapInlet.js');
var udpSpigot = require('../spout/udpSpigot.js');

var packetSize = 1500;
var numPackets = 16384;
var udpPort = netadon.createSocket('udp4', packetSize, numPackets, numPackets); 

udpPort.on('error', (err) => {
  console.log(`server error: ${err}`);
  udpPort.close();
});
var totalData = 0;
udpPort.on('message', (data) => {
  totalData += data.length; 
  console.log(`server data: ${data.length} of ${totalData}`);
});
udpPort.on('listening', () => {
  var address = udpPort.address;
  console.log(`server listening ${address.address}:${address.port}`);
});

var mcastAddress = '224.1.1.1';
var netif = '192.168.1.16';
var port = 8000;

var pcapFile = 'C:/Users/simon/OneDrive/Streampunk/nmi-examples/rtp-video-rfc4175-1080i50-colour.pcap';
var udpSource = pcapInlet(pcapFile)
  .through(udpSpigot(udpPort, mcastAddress, port, netif, 1))
  .errors(function (e) { console.error(e); });

udpSource.doto(function (x) { if (x % 1000 === 0) console.log(x); }).done(udpPort.close.bind(udpPort));
