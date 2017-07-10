(function () {
    "use strict";

    angular.module('blocktrail.core')
        .constant('_', blocktrailSDK.lodash)
        .constant('cryptoJS', window.blocktrailSDK.CryptoJS)
        .constant('bitcoinJS', window.blocktrailSDK.bitcoin)
        .constant('randomBytesJS', window.blocktrailSDK.randomBytes)
        .constant('bowserJS', window.bowser)
        .constant('PouchDB', window.PouchDB);
})();
