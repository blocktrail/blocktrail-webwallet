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

        function setupCheckInterval() {
            interval = setInterval(function() {
                db.get("LOCK")
                    .then(function(doc) {
                        if (doc.uuid !== uuid) {
                            clearInterval(interval);
                            console.log("Lost our lock");

                            lostLock();
                        }
                    });
            }, 100);
        }

        function acquireLock() {
            return db.get("LOCK")
                .catch(function() {
                    return {_id: "LOCK"};
                })
                .then(function(doc) {
                    doc.uuid = uuid;

                    return db.put(doc)
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
                .then(function() {
                    console.log("Got lock");
                    setupCheckInterval();
                });
        }

        return {
            init: init
        }
    }

})();
