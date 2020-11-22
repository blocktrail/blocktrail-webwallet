(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appBchaRecoveryWarning", appBchaRecoveryWarning);

    function appBchaRecoveryWarning() {


        return {
            restrict: "E",
            replace: true,
            templateUrl: "js/modules/wallet/directives/app-bcha-recovery-warning/app-bcha-recovery-warning.tpl.html",
            controller: function($scope, walletsManagerService, blocktrailSDK, launchService, $modal) {
                var activeWallet = walletsManagerService.getActiveWallet();

                var address = activeWallet.getNewAddress();

                $scope.requires2FA = launchService.getAccountInfo().requires2FA;
                $scope.requires2FA = launchService.getAccountInfo().requires2FA;

                $scope.sweepBCHAToSelfConfirmModal = function () {
                    return $modal.open({
                        controller: "BCHASendReplayProtectModal",
                        templateUrl: "js/modules/wallet/controllers/bcha-send-replay-protect-modal/bcha-send-replay-protect-modal.tpl.html",
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

