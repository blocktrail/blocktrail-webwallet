(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletTransaction", walletTransaction);

    function walletTransaction() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                transaction: "=",
                walletData: "=",
                onShowTransaction: "&"
            },
            templateUrl: "js/modules/wallet/directives/wallet-transaction/wallet-transaction.tpl.html",
            controller: wTransactionCtrl
        };
    }

    function wTransactionCtrl($scope) {
        $scope.isReceived = $scope.transaction["wallet_value_change"] > 0;
    }

})();
