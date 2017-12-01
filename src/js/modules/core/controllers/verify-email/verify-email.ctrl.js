(function () {
    "use strict";

    angular.module("blocktrail.core")
        .controller("VerifyEmailCtrl", VerifyEmailCtrl);

    function VerifyEmailCtrl($scope, $stateParams, $state, $translate, accountSecurityService, settingsService) {
        $scope.working  = true;
        $scope.verified = false;
        $scope.success  = false;

        // Get state parameter
        var token = $stateParams.token;

        accountSecurityService.verifyEmail(token)
            .then(function (result) {
                if(result.data.result) {
                    $scope.success = true;
                } else {
                    $scope.success = false;
                }

                return settingsService.syncSettingsDown()
                    .then(function(settingsReadOnlyData) {
                        $scope.verified = settingsReadOnlyData.verifiedEmail;
                        // Untoggle pending email verification if applicable (for email changes)
                        if (settingsReadOnlyData.pendingEmailVerification) {
                            return settingsService.updateSettingsUp({
                                pendingEmailVerification: false
                            });
                        }
                    })
                    .then(accountSecurityService.updateSecurityScore);

            })
            .then(function () {
                $scope.working = false;
            })
            .catch(function () {
                $scope.working = false;
                throw new Error($translate.instant("MSG_ERROR_TRY_AGAIN_LATER"))
            });

        $scope.continueToWallet = function() {
            $state.go("app.wallet");
        }
    }
})();
