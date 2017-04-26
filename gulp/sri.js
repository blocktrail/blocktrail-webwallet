var _ = require('lodash');
var fs = require('fs');
var Q = require('q');
var CryptoJS = require('crypto-js');

var buildSRIMap = function(files, basepath) {
    return Q.all(files.map(function(file) {
        var def = Q.defer();

        fs.readFile(file, function(err, filedata) {
            if (err) {
                def.reject(err);
                return;
            }

            var sha = CryptoJS.SHA256(CryptoJS.enc.Base64.parse(filedata.toString('base64'))).toString(CryptoJS.enc.Base64);

            def.resolve({filename: file, sha256: sha});
        });

        return def.promise;
    })).then(function(results) {
        var map = {};

        _.forEach(results, function(r) {
            map[r.filename.replace(basepath, "")] = r.sha256;
        });

        return map;
    });
};

module.exports = exports = buildSRIMap;
