(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("walletEmailVerified", walletEmailVerified);

    function walletEmailVerified() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                success: "=",
                verified: "="
            },
            templateUrl: "js/modules/core/directives/wallet-email-verified/wallet-email-verified.tpl.html"
        };
    }

})();
