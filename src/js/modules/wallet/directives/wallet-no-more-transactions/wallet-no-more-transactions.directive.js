(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletNoMoreTransactions", walletNoMoreTransactions);

    function walletNoMoreTransactions() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/wallet-no-more-transactions/wallet-no-more-transactions.tpl.html"
        };
    }

})();
