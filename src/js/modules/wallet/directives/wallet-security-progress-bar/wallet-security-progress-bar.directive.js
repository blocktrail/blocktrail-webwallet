(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletSecProgressBar", walletSecurityProgressBar);

    function walletSecurityProgressBar() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                status: '='
            },
            templateUrl: "js/modules/wallet/directives/wallet-security-progress-bar/wallet-security-progress-bar.tpl.html"
        };
    }

})();
