angular.module('blocktrail.wallet').factory(
    'storageService',
    function(CONFIG, $log, PouchDB) {
        var dbs = {};
        var adapter = CONFIG.POUCHDB_DRIVER;

        // use in-memory adapter when ixdb isn't supported
        $log.debug('window.supportsIndexedDB: ' + window.supportsIndexedDB);
        if (window.supportsIndexedDB === false) {
            adapter = 'memory';
        }

        var db = function(name) {
            if (!dbs[name]) {
                dbs[name] = new PouchDB(name, {adapter: adapter});
            }

            return dbs[name];
        };

        var destroy = function(name) {
            return db(name).destroy().then(function(result) {
                delete dbs[name];
            });
        };

        var resetAll = function() {
            return Q.all(Object.keys(dbs).map(function(name) {
                var adapter = db(name).adapter;

                return db(name).destroy().then(function() {
                    if (adapter === 'idb') {
                        indexedDB.deleteDatabase('_pouch_' + name);
                    }

                    return db(name);
                });
            })).then(
                function(dbs) { return true; },
                function(e) { console.error(e); });
        };

        // init defaults
        db('launch');
        db('contacts');
        db('wallet');
        db('wallet_info');
        db('settings');

        return {
            db: db,
            destroy: destroy,
            resetAll: resetAll
        };
    }
);
