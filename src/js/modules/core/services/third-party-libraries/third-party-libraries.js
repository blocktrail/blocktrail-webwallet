(function () {
    "use strict";

    angular.module('blocktrail.core')
        .constant('CryptoJS', window.blocktrailSDK.CryptoJS)
        .constant('Bowser', window.bowser);
})();
