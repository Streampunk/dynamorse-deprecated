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

var fs = require('fs');
var async = require('async');
var RTPPacket = require('../model/RTPPacket.js');

var pcapFile = process.argv[2];
//'/Users/vizigoth/Documents/streampunk/nmi/phase1/examples/rtp-video-rfc4175-1080i50-sync.pcap';

var fd = 0;
var justRead = 0;
var globalHeader = new Buffer(24);
var packetHeader = new Buffer(16);
var packetCount = 0;
var startTime = Date.now();

async.waterfall([
  function (callback) {
    fs.open(pcapFile, 'r', function (err, fde) {
      if (err) return callback(err);
      console.log('Open.');
      fd = fde;
      callback();
    })
  },
  function (callback) {
    fs.read(fd, globalHeader, 0, 24, null, function (err, bytesRead) {
      if (err) return callback(err);
      justRead = bytesRead;
      console.log('Read global header', globalHeader);
      callback();
    })
  },
  function (callback) {
    startTime = Date.now();
    fs.read(fd, packetHeader, 0, 16, null, function (err, bytesRead) {
      if (err) return callback(err);
      justRead = bytesRead;
      var incl_len = packetHeader.readUInt32LE(8);
      console.log('Read', bytesRead, 'First packet is length ' + incl_len);
      callback(null, incl_len);
    })
  },
  function (len, callback) {
    // console.log('About to whilst.');
    async.whilst(
      function() { return justRead > 0 && packetCount < 5; },
      function (whilstback) {
        // console.log('Whilstback!', len, justRead);
        async.series([
          function (packetback) {
            // console.log('About to read.');
            fs.read(fd, new Buffer(len), 0, len, null, function (err, br, buf) {
              // console.log('read', br);
              if (err) return packetback(err);
              console.log(JSON.stringify(buf.slice(42)));
              packetCount++;
              packetback();
            });
          },
          function (packetback) {
            // console.log('Next in line.');
            fs.read(fd, packetHeader, 0, 16, null, function (err, bytesRead) {
              // console.log('And now ', bytesRead, err);
              if (err) return packetback(err);
              justRead = bytesRead;

              if (bytesRead > 12) {
                var incl_len = packetHeader.readUInt32LE(8);
                // console.log('Read', bytesRead, 'First packet is length ' + incl_len);
                len = incl_len;
              } else { len = 0; }
              packetback();
            });
          }
        ], function (err) { whilstback(err) });
      },
      function (err) { callback(err); }
    );
  },
  function (callback) {
    fs.close(fd, function(err) {
      if (err) return callback(err);
      console.log('Close.', packetCount);
      callback();
    })
  }
], function (err) { if (err) console.log(err); else console.log('Phew! ' + (Date.now() - startTime)); });
