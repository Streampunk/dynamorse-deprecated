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

var dgram = require('dgram');
var sock = dgram.createSocket({ type : 'udp4', reuseAddr : true });
sock.bind(+process.argv[3]);
sock.addMembership(process.argv[2], process.argv[4]);

setTimeout(function () {}, 1000000000);
