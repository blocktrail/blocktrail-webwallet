(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletNoTransactions", walletNoTransactions);

    function walletNoTransactions() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/wallet-no-transactions/wallet-no-transactions.tpl.html"
        };
    }

})();
