(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupForgotPasswordCtrl", SetupForgotPasswordCtrl);

    function SetupForgotPasswordCtrl($scope, $http, CONFIG) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.form     = {
            email : null
        };

        $scope.stepCount = 0;

        $scope.doForgotPass = function (forgotPassForm) {

            if ($scope.working) {
                return false;
            }
            $scope.error = null;
            if (forgotPassForm.$invalid) {
                return false;
            }
            $scope.working = true;
            requestRecovery($scope.form.email).then(
                function () {
                    $scope.stepCount = 1;
                    $scope.working = false;
                }
            );
        };

        function requestRecovery(email) {
            // request recovery secret from backend
            return $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "tBTC" : "BTC") + "/recovery/request-link", { email: email } );
        }
    }
})();
