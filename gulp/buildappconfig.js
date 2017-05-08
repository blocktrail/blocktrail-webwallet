var fs = require('fs');
var path = require('path');
var Q = require('q');
var exec = require('child_process').exec;

var readAppConfig = require('./readappconfig');

function _command (cmd, cb) {
    exec(cmd, function (err, stdout, stderr) {
        cb(stdout.split('\n').join(''))
    })
}

var gitRev = {
    short : function (cb) {
        _command('git rev-parse --short HEAD', cb)
    },
    long : function (cb) {
        _command('git rev-parse HEAD', cb)
    },
    branch : function (cb) {
        _command('git rev-parse --abbrev-ref HEAD', cb)
    },
    tag : function (cb) {
        _command('git describe --always --tag --abbrev=0 --exact-match HEAD', cb)
    }
};

/**
 * build appconfig from .json files
 *
 * @returns {Q.Promise}
 */
var buildAppConfig = function() {
    var def = Q.defer();

    gitRev.branch(function(branch) {
        gitRev.short(function(rev) {
            gitRev.tag(function(tag) {
                var config = {
                    VERSION: tag || null,
                    VERSION_REV: branch + ":" + rev
                };

                config = readAppConfig(config);

                if (typeof config.API_HTTPS !== "undefined" && config.API_HTTPS === false) {
                    config.API_URL = "http://" + config.API_HOST;
                } else {
                    config.API_URL = "https://" + config.API_HOST;
                }

                config.STATICSDIR = config.STATICSDIR || (config.VERSION || config.VERSION_REV).replace(":", "-").replace(".", "-");
                if (config.CDN) {
                    if (config.CDN.substr(-1) != "/") throw new Error("CDN should have trailing /");
                    config.STATICSURL = config.CDN + config.STATICSDIR;
                } else {
                    config.STATICSURL = config.STATICSDIR;
                }


                def.resolve(config);
            });
        });
    });

    return def.promise;
};

module.exports = exports = buildAppConfig;
