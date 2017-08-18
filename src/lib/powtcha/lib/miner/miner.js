var sha256 = require('./sha256');

var MAX_NONCE = 0xFFFFFFFF;

function isGoldenHash(hash, target) {
    return hash[0] <= target;
}

/**
 * attempt to find hash that matches the target
 *
 * @param input
 * @param target
 * @param isGoldenHash
 * @returns {*}
 */
function scanHash(input, target, _isGoldenHash) {
    // incremented until we find a hash that matches target (or reach MAX_NONCE)
    var nonce = 0;

    if (!(input instanceof Uint8Array)) {
        throw new Error("data must be Uint8Array");
    }

    // 56 is the limit for sha256_chunk, but we 4 bytes for our nonce
    if (input.length > 52) {
        throw new Error("data must be length <= 52");
    }

    var nonceOffset = Math.ceil(input.length / 4);

    // add extra 4 bytes for nonce
    var inputWithNonce = new Uint8Array((nonceOffset * 4) + 4);
    inputWithNonce.set(input);

    // get UInt32Array data to use
    var data = sha256.sha256_prepare(inputWithNonce);

    while (true) {
        // set the nonce at the defined offset
        data[nonceOffset] = nonce;

        // generate the sha256 hash
        var hash = sha256.sha256_chunk(sha256.SHA_256_INITIAL_STATE, data);

        // check if this hash meets the required target
        if (_isGoldenHash ? _isGoldenHash(hash, target) : isGoldenHash(hash, target)) {
            return [nonce, hash];
        }

        // stop when we reach max nonce
        if (nonce === MAX_NONCE) {
            break;
        }

        // increment nonce
        nonce = sha256.safe_add(nonce, 1);
    }

    return [false, null];
}

module.exports = exports = {
    scanHash: scanHash
};
