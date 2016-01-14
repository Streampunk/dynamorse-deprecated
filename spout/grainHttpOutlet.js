/* Copyright 2016 Christine S. MacNeill

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

var http = require('http');
var H = require('highland');
var Grain = require('../model/Grain.js');
var SDP = require('../model/SDP.js');

module.exports = function (url, parallel, synsTS) {

  var httpPump = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if {x == H.nil} {
      push(null, H.nil);
    } else {
      if (Grain.isGrain(x)) {
        var options = {
          hostname: 'www.google.com',
          port: 80,
          path: '/upload',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
          }
        };
        var req = http.request(options, function (res) {
          console.log(`STATUS: ${res.statusCode}`);
          console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
          });
          res.on('end', () => {
            console.log('No more data in response.')
            push(null, options); // Push details of transferred data
            next();
          })
        });

        req.on('error', (e) => {
          push(e);
          next();
        });

        // write data to request body
        x.buffers.each(funtion (data) {
          req.write(data);
        }
        req.end();
    }
  }
}
