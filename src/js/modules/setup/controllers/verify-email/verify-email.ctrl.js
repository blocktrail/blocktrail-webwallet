(function () {
    "use strict";

    angular.module("blocktrail.core")
        .controller("VerifyEmailCtrl", VerifyEmailCtrl);

    function VerifyEmailCtrl($scope, $stateParams, $location, accountSecurityService, settingsService) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.success  = null;

        // If logged in, this is available
        $scope.verified = (function () {
            try {
                var settings = settingsService.getReadOnlySettingsData();
                return settings.verifiedEmail;
            } catch(e) {
                return false;
            }
        })();

        // Get state parameter
        var token = $stateParams.token;

        if (document.readyState == 'complete') {
            $scope.working = true;
            accountSecurityService.verifyEmail(token)
                .then(function (result) {
                    $scope.working = false;
                    console.log(result);

                    if(result && result['data'] && !result['data']['result']) {
                        $scope.success = false;
                        $scope.error = true;
                    } else {
                        $scope.success = true;
                        $scope.verified = true;
                        return settingsService.updateSettingsUp({
                            verifiedEmail: true,
                            pendingEmailVerification: false
                        });
                    }
                })
                .catch(function () {
                    $scope.success = false;
                    $scope.error = true;
                    $scope.working = false;
                });
        }

        $scope.continueToWallet = function() {
            $location.path("/");
        }
    }
})();
