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

var fs = require('fs');
var mp4 = require('mp4-stream');

var stream = mp4.decode();

var processHeaders = function (stream, headers) {
  console.log('found box', headers);
  if (headers.type === 'ftyp' || headers.type === 'mdat') {
    stream.decode(function (box) {
      console.log('box is', box);
    });
  } else if (headers.type === 'wide') {
    var subStream = mp4.decode();
    subStream.on('box', processHeaders.bind(null, stream));
    subStream.on('end', function() {  });
    stream.stream().pipe(stream);
    console.log(subStream);
  } else {
    stream.ignore();
  }
}

stream.on('box', processHeaders.bind(null, stream));
stream.on('error', console.error);

fs.createReadStream('NTSC_720p_AVC-I_colorbar.mov').pipe(stream);
