(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appBsvRecoveryWarning", appBsvRecoveryWarning);

    function appBsvRecoveryWarning() {


        return {
            restrict: "E",
            replace: true,
            templateUrl: "js/modules/wallet/directives/app-bsv-recovery-warning/app-bsv-recovery-warning.tpl.html",
            controller: function($scope, walletsManagerService, blocktrailSDK, launchService, $modal) {
                var activeWallet = walletsManagerService.getActiveWallet();

                var address = activeWallet.getNewAddress();

                $scope.requires2FA = launchService.getAccountInfo().requires2FA;
                $scope.requires2FA = launchService.getAccountInfo().requires2FA;

                $scope.sweepToSelfConfirmModal = function () {
                    return $modal.open({
                        controller: "SendReplayProtectModal",
                        templateUrl: "js/modules/wallet/controllers/send-replay-protect-modal/send-replay-protect-modal.tpl.html",
                        size: "md",
                        backdrop: "static",
                        resolve: {
                            activeWallet: function () {
                                return activeWallet;
                            },
                            sendData: function () {
                                return address.then(function (address) {
                                    return activeWallet.getSdkWallet().maxSpendable(true, blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY)
                                        .then(function (maxSpendable) {
                                            var maxSpendableAmount = blocktrailSDK.toBTC(maxSpendable.max);

                                            return {
                                                feeChoice: blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL,
                                                recipientAddress: address,
                                                amount: maxSpendableAmount,
                                                requires2FA: $scope.requires2FA
                                            };
                                        });
                                });
                            }
                        }
                    });
                }
            }
        };
    }

})();

