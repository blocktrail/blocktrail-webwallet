(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupForgotPasswordCtrl", SetupForgotPasswordCtrl);

    function SetupForgotPasswordCtrl($scope, passwordRecoveryService) {
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
            passwordRecoveryService.requestRecoveryMail($scope.form.email).then(
                function () {
                    $scope.stepCount = 1;
                    $scope.working = false;
                }
            );
        };
    }
})();
