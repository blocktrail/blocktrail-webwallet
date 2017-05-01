var Q = require('q');

/**
 * helper to wrap a stream with a promise for easy chaining
 * @param stream
 * @returns {Q.Promise}
 */
var streamAsPromise = function(stream) {
    var def = Q.defer();

    stream
        .on('end', function() {
            def.resolve();
        })
        .on('error', function(e) {
            def.reject(e);
        })
    ;

    return def.promise;
};

module.exports = exports = streamAsPromise;
