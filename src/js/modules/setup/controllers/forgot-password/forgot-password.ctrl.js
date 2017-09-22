(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupForgotPasswordCtrl", SetupForgotPasswordCtrl);

    function SetupForgotPasswordCtrl($scope, passwordRecoveryService, dialogService, $translate) {
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
            passwordRecoveryService.requestRecoveryMail($scope.form.email)
                .then(function () {
                    $scope.stepCount = 1;
                    $scope.working = false;
                }).catch(function (result) {
                    if (result && result.data && result.data.error && result.data.error === 'v2') {
                        $scope.working = false;
                        return dialogService.alert(
                            $translate.instant("RECOVERY_ERROR"),
                            $translate.instant("MSG_RECOVERY_V2_UPGRADED")
                        ).result;
                    }
                });
        };
    }
})();
