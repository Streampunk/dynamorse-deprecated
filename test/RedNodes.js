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

var test = require('tape');
var fs = require('fs');
var path = require('path');

var userNodeDir = "../reduser/nodes";

function listFiles(dir, ext, cb) {
  fs.readdir(dir, function(err, files) {
    if (err)
      cb(err);

    files.forEach(function(file, index) {
      var nodePath = path.join(dir, file);
      fs.stat(nodePath, function(error, stat) {
        if (error) {
          cb(error);
          return;
        }

        if (stat.isFile()) {
          if (ext === path.extname(nodePath))
            cb(null, nodePath);
          return;
        }
        else if (stat.isDirectory())
          listFiles(nodePath, ext, cb);
      });
    });
  });
}

test('Check all nodes in user folder', function(t) {
  listFiles(userNodeDir, '.js', function(err, file) {
    if (err) {
      t.fail(err);
    }
    else {
      function testFile() { require(file); }
      t.doesNotThrow(testFile, file);    
    }
  });
  t.end();
});
