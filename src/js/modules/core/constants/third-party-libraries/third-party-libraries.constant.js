(function () {
    "use strict";

    angular.module("blocktrail.core")
        .constant('blocktrailSDK',  window.blocktrailSDK)
        .constant('bip70',          window.bip70)
        .constant('bip39EN',        window.blocktrailSDK.bip39wordlist)
        .constant("_",              window.blocktrailSDK.lodash)
        .constant("cryptoJS",       window.blocktrailSDK.CryptoJS)
        .constant("bitcoinJS",      window.blocktrailSDK.bitcoin)
        .constant("BlocktrailBitcoinService", window.blocktrailSDK.BlocktrailBitcoinService)
        .constant("SPVBridgeBitcoinService", window.blocktrailSDK.SPVBridgeBitcoinService)
        .constant("bip39",          window.blocktrailSDK.bip39)
        .constant("randomBytesJS",  window.blocktrailSDK.randomBytes)
        .constant("bowserJS",       window.bowser)
        .constant("PouchDB",        window.PouchDB)
        .constant("powtcha",        window.powtcha)
        .constant("navigator",      window.navigator)
        .constant("zxcvbn",         window.zxcvbn);
})();
