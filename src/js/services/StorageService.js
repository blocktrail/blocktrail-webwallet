angular.module('blocktrail.wallet').factory(
    'storageService',
    function(CONFIG) {
        var dbs = {};

        var db = function(name) {
            if (!dbs[name]) {
                dbs[name] = new PouchDB(name, {adapter: CONFIG.POUCHDB_DRIVER});
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
        db('tx-cache');
        db('wallet-cache');
        db('history');
        db('wallet_info');
        db('settings');

        return {
            db: db,
            destroy: destroy,
            resetAll: resetAll
        };
    }
);
