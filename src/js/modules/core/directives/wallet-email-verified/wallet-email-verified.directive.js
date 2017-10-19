(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletEmailVerified", walletEmailVerified);

    function walletEmailVerified() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                success: "="
            },
            templateUrl: "js/modules/core/directives/wallet-email-verified/wallet-email-verified.tpl.html"
        };
    }

})();
