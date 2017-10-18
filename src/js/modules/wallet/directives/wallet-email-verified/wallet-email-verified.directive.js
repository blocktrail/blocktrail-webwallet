(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletEmailVerified", walletEmailVerified);

    function walletEmailVerified() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/wallet-email-verified/wallet-email-verified.tpl.html"
        };
    }

})();
