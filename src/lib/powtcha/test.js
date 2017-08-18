exports = module.exports = {
    PoWtcha: require('./'),

    // test config which we can modify from external source
    config: require('./test/testconfig'),

    // for reading config values from querystring
    qs: require('querystring'),

    miner_test: {
        util_test: require('./test/miner.util.test'),
        sha256_test: require('./test/miner.sha256.test'),
        miner_test: require('./test/miner.test')
    },
    PoWtcha_test: require('./test/powtcha.test')
};
