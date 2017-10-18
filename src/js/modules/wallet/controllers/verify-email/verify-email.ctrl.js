(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("VerifyWalletEmailCtrl", VerifyWalletEmailCtrl);

    function VerifyWalletEmailCtrl($scope, $stateParams, $location, accountSecurityService) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.success  = null;

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
                    }
                })
                .catch(function () {
                    $scope.error = true;
                    $scope.success = false;
                    $scope.working = false;
                });
        }

        $scope.continueToWallet = function() {
            $location.path("/");
        }
    }
})();
