(function () {
    "use strict";

    angular.module("blocktrail.core")
        .controller("VerifyEmailCtrl", VerifyEmailCtrl);

    function VerifyEmailCtrl($rootScope, $scope, $stateParams, $location, accountSecurityService, settingsService, $q) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.success  = null;

        // If logged in, this is available
        $scope.verified = (function () {
            try {
                return settingsService._syncSettingsAndProfileDown().then(function () {
                    var settings = settingsService.getReadOnlySettingsData();
                    return settings.verifiedEmail;
                })
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
                            accountSecurityService.updateSecurityScore();
                            return result;
                        }).catch(function () {
                            console.log("failed updating settings, not logged in?");
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
