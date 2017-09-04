(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wNoMoreTransactions", wNoMoreTransactions);

    function wNoMoreTransactions() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/w-no-more-transactions/w-no-more-transactions.tpl.html"
        };
    }

})();
