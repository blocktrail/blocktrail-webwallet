(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wTransaction", wTransaction);

    function wTransaction() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                transaction: "=",
                onShowTransaction: "&"
            },
            templateUrl: "js/modules/wallet/directives/w-transaction/w-transaction.tpl.html",
            controller: wTransactionCtrl
        };
    }

    function wTransactionCtrl($scope) {
        $scope.isReceived = $scope.transaction["wallet_value_change"] > 0;
    }

})();
