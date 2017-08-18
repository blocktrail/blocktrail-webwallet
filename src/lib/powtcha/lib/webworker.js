var miner = require('./miner/miner');

module.exports = function(self) {
    self.addEventListener('message', function(e) {
        var data = e.data || {};

        switch (data.method) {
            case 'miner.scanHash':
                (function() {
                    try {
                        var salt = typeof data.salt !== "undefined" ? Buffer.from(data.salt.buffer) : undefined;
                        var target = typeof data.target !== "undefined" ? data.target : undefined;

                        var result = miner.scanHash(salt, target);
                        self.postMessage({id: data.id, result: result});
                    } catch (e) {
                        e.id = data.id;
                        throw e;
                    }
                })();
                break;

            default:
                e = new Error('Invalid method [' + data.method + ']');
                e.id = data.id;
                throw e;
        }
    }, false);
};
