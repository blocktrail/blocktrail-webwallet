(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupNewAccountCtrl", SetupNewAccountCtrl);

    function SetupNewAccountCtrl($scope, $state, $q, CONFIG, dialogService, $translate, FormHelper, passwordStrengthService, $filter, newAccountFormService, powtchaService, sdkService) {
        var powtchaPromise;
        var listenerForm;
        var listenerFormPassword;

        // display mobile app download popup
        $scope.showMobileDialogOnce();
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();

        $scope.isLoading = false;
        $scope.networkTypes = getNetworkTypes();
        $scope.errMsg = false;
        $scope.form = {
            // username: null,
            email: null,
            password: null,
            passwordCheck: null,
            networkType: sdkService.getNetworkType(),
            termsOfService: false
        };

        // Listeners
        listenerForm = $scope.$watch("form", onFormChange, true);
        listenerFormPassword = $scope.$watch("form.password", onFormPasswordChange, true);

        $scope.$on("$destroy", onScopeDestroy);

        // Methods
        $scope.onSubmitFormRegister = onSubmitFormRegister;

        refreshPowtchaPromise();

        /**
         * Get the network types
         * @return { Array }
         */
        function getNetworkTypes() {
            var list = [];

            CONFIG.NETWORKS_ENABLED.forEach(function(networkType) {
                if(CONFIG.NETWORKS[networkType]) {
                    list.push({
                        label: CONFIG.NETWORKS[networkType].NETWORK_LONG + " (" + CONFIG.NETWORKS[[networkType]].NETWORK + ")",
                        value: networkType
                    });
                }
            });

            return list;
        }

        /**
         * On form change handler
         * @param newValue
         * @param oldValue
         */
        function onFormChange(newValue, oldValue) {
            $scope.errMsg = false;

            if(newValue.networkType !== oldValue.networkType) {
                sdkService.setNetworkType(newValue.networkType);
            }
        }

        /**
         * On form password change handler
         * @param newValue
         */
        function onFormPasswordChange(newValue) {
            if (!newValue) {
                $scope.passwordCheck = null;
                return $q.when(false);
            }

            return passwordStrengthService.checkPassword($scope.form.password, [$scope.form.username, $scope.form.email, "BTC.com", "wallet"])
                .then(function(result) {
                    result.duration = $filter("duration")(result.crack_times_seconds.online_no_throttling_10_per_second * 1000);
                    $scope.form.passwordCheck = result;
                    return result;
                });
        }

        /**
         * Refresh the powtcha promise
         */
        function refreshPowtchaPromise() {
            powtchaPromise = powtchaService.newPoWtcha();
            powtchaPromise.then(function(powtcha) {
                powtcha.startingWorkingBG();
            });
        }

        /**
         * On submit the form register handler
         * @param registerForm
         * @return { boolean | promise }
         */
        function onSubmitFormRegister(registerForm) {
            $scope.errMsg = null;

            FormHelper.setAllDirty(registerForm);

            if (registerForm.$invalid) {
                return false;
            }

            if (!$scope.form.termsOfService) {
                $scope.errMsg = "MSG_BAD_LEGAL";
                return false;
            }

            if (!$scope.form.passwordCheck || $scope.form.passwordCheck.score < CONFIG.REQUIRED_PASSWORD_STRENGTH) {
                $scope.errMsg = "MSG_WEAK_PASSWORD";
                return false;
            }

            return openRepeatPasswordDialog()
                .result
                .then(function(dialogResult) {
                    if ($scope.form.password === dialogResult.trim()) {
                        $scope.isLoading = true;

                        register();
                    } else {
                        $scope.errMsg = "MSG_BAD_PASSWORD_REPEAT";
                    }
                });
        }

        /**
         * Open the repeat password dialog
         * @return { promise }
         */
        function openRepeatPasswordDialog() {
            return dialogService.prompt({
                title: $translate.instant("MSG_REPEAT_PASSWORD"),
                body: $translate.instant("SETUP_PASSWORD_REPEAT_PLACEHOLDER"),
                input_type: "password",
                icon: "key"
            });
        }

        /**
         * Register
         * @return { promise }
         */
        function register() {
            return newAccountFormService.register($scope.form, powtchaPromise)
                .then(registerFormSuccessHandler, registerFormErrorHandler);
        }

        /**
         * Register form success handler
         */
        function registerFormSuccessHandler() {
            $scope.setupInfo.password = $scope.form.password;

            $scope.isLoading = false;

            $state.go('app.setup.wallet');
        }

        /**
         * Register form error handler
         */
        function registerFormErrorHandler(error) {
            refreshPowtchaPromise();
            $scope.errMsg = error;
            $scope.isLoading = false;
        }

        /**
         * On the scope destroy handler
         */
        function onScopeDestroy() {
            if(listenerForm) {
                listenerForm();
            }

            if(listenerFormPassword) {
                listenerFormPassword();
            }

            $scope.alert.dismiss();
        }
    }
})();
