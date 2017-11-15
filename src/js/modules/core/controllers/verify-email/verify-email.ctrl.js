(function () {
    "use strict";

    angular.module("blocktrail.core")
        .controller("VerifyEmailCtrl", VerifyEmailCtrl);

    function VerifyEmailCtrl($scope, $stateParams, $location, accountSecurityService, settingsService, $q) {
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

                        $q.when(settingsService.updateSettingsUp({
                            verifiedEmail: true,
                            pendingEmailVerification: false
                        })).then(function (result) {
                            return result;
                        }).catch(function () {
                            console.log("failed updating settings");
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
