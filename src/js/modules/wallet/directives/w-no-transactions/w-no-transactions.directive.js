(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wNoTransactions", wNoTransactions);

    function wNoTransactions() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/w-no-transactions/w-no-transactions.tpl.html"
        };
    }

})();
