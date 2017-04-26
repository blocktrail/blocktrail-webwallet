var _ = require('lodash');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');

var readAppConfig = function(config) {
    config = config || {};

    ['./appconfig.json', './appconfig.default.json'].forEach(function(filename) {
        var json = fs.readFileSync(filename);

        if (json) {
            var data = JSON.parse(stripJsonComments(json.toString('utf8')));
            config = _.defaults(config, data);
        }
    });

    return config;
};

module.exports = exports = readAppConfig;
