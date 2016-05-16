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

var H = require('highland');
var SDP = require('../model/SDP.js');

// Assuming SDP file address/port is provided on start. Error otherwise.
module.exports = function(server, sdpOrAddress, port, netif, ttl) {
  var address = sdpOrAddress;
  if (SDP.isSDP(sdpOrAddress)) {
    address = sdp.getConnectionAddress(0);
    port = sdp.getPort(0);
    netif = sdp.getOriginUnicastAddress();
    ttl = sdp.getConnectionTTL(0);
  }
  var initState = true;
  var packetCounter = 0;
  var packetSender = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      if (initState) {
        if (port !== undefined && address !== undefined &&
            typeof port === 'number' && typeof address === 'string') {
          console.log('About to bind', port);
          initState = false;
          server.bind(port, function (err) {
            if (err) { push(err); push(null, H.nil); }
            server.setBroadcast(true);
            server.addMembership(address, netif, function (err) {
              console.log(err);
            });
            if (typeof ttl === 'number') server.setMulticastTTL(ttl);
            console.log('Binding complete. Recalling.');
            packetSender(err, x, push, next);
          });
        } else {
          push(new Error('Cannot send packets to an unconfigured UDP server.'));
          push(null, H.nil);
        }
      } else {
        if (Buffer.isBuffer(x)) {
          server.send(x, 0, x.length, port, address, function (err) {
            if (err) push(err);
            push(null, packetCounter++);
          });
        }
        next();
      }
    }
  }
  return H.pipeline(H.consume(packetSender));
}
