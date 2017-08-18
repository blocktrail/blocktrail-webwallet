/* global URL, window, navigator */
var webworkify = require('webworkify');
var Promise = require('es6-promise').Promise;
var worker = null;
var first = true;
var lastId = 0;

var init = function() {
    worker = webworkify(require('./webworker'));
};

function defer() {
    var resolve, reject;
    var promise = new Promise(function(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
    });

    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
}

var executeFunction = function(self, message) {
    // create promise for result
    var deferred = defer();

    try {
        // keep a unique id to distinguish between responses
        var id = lastId++;

        var onMessage = function(e) {
            // on first message we cleanup memory by revoking the blob
            if (first) {
                first = false;
                URL.revokeObjectURL(worker.objectURL);
            }

            // don't process messages that aren't for us
            if (e.data.id !== id) {
                return;
            }

            deferred.resolve(e.data.result);
        };

        var onError = function(e) {
            deferred.reject(new Error(e.message.replace(/Uncaught (Assertion)?Error: /, '')));
        };

        var unsub = function() {
            worker.removeEventListener("message", onMessage);
            worker.removeEventListener("error", onError);
        };

        // register event listeners
        worker.addEventListener('message', onMessage, false);
        worker.addEventListener('error', onError, false);

        // submit message to worker to init work
        message.id = id;
        worker.postMessage(message);

        // return promise
        return deferred.promise.then(function(r) {
            unsub();
            return r;
        }, function(e) {
            unsub();
            throw e;
        });
    } catch (e) {
        deferred.reject(e);
        return deferred.promise;
    }
};

var webworkifier = function(message) {
    if (worker === null) {
        init();
    }

    return executeFunction(worker, message);
};

webworkifier.isSupported = function() {
    var isNodeJS = !process.browser;
    var useWebWorker = !isNodeJS && typeof window !== "undefined" && typeof window.Worker !== "undefined";

    var androidVersion = ((typeof navigator !== "undefined" && navigator.userAgent) || "").match(/Android (\d)\.(\d)(\.(\d))/);

    if (androidVersion) {
        if (androidVersion[1] <= 4) {
            useWebWorker = false;
        }
    }

    return useWebWorker;
};

module.exports = webworkifier;
