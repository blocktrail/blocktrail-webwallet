(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('globalLockService', globalLockService);

    function globalLockService($state, storageService, randomBytesJS) {
        var uuid = randomBytesJS(32).toString('hex');
        var db = storageService.db('LOCK');
        var interval;
        var initialized = false;

        function lostLock() {
            return $state.go('app.lostlock', {refresh: 1});
        }

        function checkLock() {
            return db.get("LOCK")
                .then(function(doc) {
                    if (doc.uuid !== uuid) {
                        console.log("Lost our lock");

                        lostLock();
                    } else {
                        doc.ts = (new Date).getTime();

                        return db.put(doc);
                    }
                });
        }

        function setupCheckTimeout() {
            setTimeout(function() {
                checkLock().then(function() {
                    setupCheckTimeout();
                });
            }, 100);
        }

        function acquireLock() {
            return db.get("LOCK")
                .catch(function() {
                    return {_id: "LOCK", uuid: null, ts: null};
                })
                .then(function(doc) {
                    var prevTs = doc.ts;

                    doc.uuid = uuid;
                    doc.ts = (new Date).getTime();

                    // check if we took a recently active lock
                    var tookLook = prevTs && prevTs > doc.ts - 1000;

                    return db.put(doc).then(function() {
                        return tookLook;
                    });
                });
        }

        function init() {
            // only do this once
            if (initialized) {
                return;
            }
            initialized = true;

            return acquireLock()
                .catch(function() {
                    console.log("Can't get lock");

                    lostLock();
                })
                .then(function(tookLock) {
                    console.log(tookLock ? "Took lock" : "Got lock");
                    setupCheckTimeout();
                });
        }

        return {
            init: init
        }
    }

})();
