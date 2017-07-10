(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupForgotPasswordCtrl", SetupForgotPasswordCtrl);

    function SetupForgotPasswordCtrl($scope, $http, FormHelper, CONFIG) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.form     = {
            email : null
        };

        $scope.doForgotPass = function(forgotPassForm) {
            if ($scope.working) {
                return false;
            }
            $scope.error = null;
            FormHelper.setAllDirty(forgotPassForm);
            if (forgotPassForm.$invalid) {
                return false;
            }
            $scope.working = true;

            $http.post(CONFIG.API_URL + "/json/user/profile/forgotpass", {
                email: $scope.form.email
            }).then(
                function(result) {
                    $scope.working = false;
                },
                function(error) {
                    $scope.working = false;
                }
            );
        };
    }
})();
