(function () {
    "use strict";

    angular.module("blocktrail.core")
        .constant('bip39EN', blocktrailSDK.bip39wordlist)
        .constant("_", blocktrailSDK.lodash)
        .constant("cryptoJS", window.blocktrailSDK.CryptoJS)
        .constant("bitcoinJS", window.blocktrailSDK.bitcoin)
        .constant("BlocktrailBitcoinService", window.blocktrailSDK.BlocktrailBitcoinService)
        .constant("bip39", window.blocktrailSDK.bip39)
        .constant("randomBytesJS", window.blocktrailSDK.randomBytes)
        .constant("bowserJS", window.bowser)
        .constant("PouchDB", window.PouchDB);
})();
