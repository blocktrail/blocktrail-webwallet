(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("WalletTransactionInfoModalCtrl", WalletTransactionInfoModalCtrl);

    function WalletTransactionInfoModalCtrl($scope, $modalInstance, data) {
        $scope.transaction = data.transaction;
        $scope.localCurrency = data.localCurrency;

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        }
    }

})();
