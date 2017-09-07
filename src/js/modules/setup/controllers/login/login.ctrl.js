(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupLoginCtrl", SetupLoginCtrl);

    function SetupLoginCtrl($scope, $translate, $state, $sce, CONFIG, dialogService, FormHelper, loginFormService, sdkService) {
        var listenerForm;
        var twoFactorToken = null;

        // display mobile app download popup
        $scope.showMobileDialogOnce();
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();

        $scope.isDebugMode = CONFIG.DEBUG;
        $scope.isLoading = false;
        $scope.error = null;
        $scope.errorDetailed = null;
        $scope.form = {
            username: "",
            password: "",
            forceNewWallet: false,
            networkType: sdkService.getNetworkType()
        };

        // Listeners
        listenerForm = $scope.$watch("form", onFormChange, true);

        $scope.$on('$destroy', onScopeDestroy);

        // Methods
        $scope.onSubmitFormLogin = onSubmitFormLogin;

        /**
         * On form change handler
         * @param newValue
         * @param oldValue
         */
        function onFormChange(newValue, oldValue) {
            $scope.error = null;
            $scope.errorDetailed = null;

            if(newValue.networkType !== oldValue.networkType) {
                sdkService.setNetworkType(newValue.networkType);
            }
        }

        /**
         * On submit form login handler
         * @param loginForm
         * @return { boolean }
         */
        function onSubmitFormLogin(loginForm) {
            $scope.error = null;
            $scope.errorDetailed = null;

            FormHelper.setAllDirty(loginForm);

            if (loginForm.$invalid) {
                return false;
            }

            $scope.isLoading = true;

            twoFactorToken = null;

            login();
        }

        /**
         * Login
         * @return { promise }
         */
        function login() {
            var data = {
                login: $scope.form.username,
                password: $scope.form.password,
                twoFactorToken: twoFactorToken,
                networkType: $scope.form.networkType
            };

            return loginFormService.login(data)
                .then(loginFormSuccessHandler, loginFormErrorHandler);
        }

        /**
         * Login success handle
         * @param data
         */
        function loginFormSuccessHandler(data) {
            if (!$scope.form.forceNewWallet) {
                $scope.setupInfo.identifier = data.existing_wallet || $scope.setupInfo.identifier;
            }

            $scope.setupInfo.password = $scope.form.password;
            $scope.setupInfo.network = $scope.form.network;

            $state.go('app.setup.wallet');
        }

        /**
         * Login error handle
         * @param error
         */
        function loginFormErrorHandler(error) {
            switch (error.type) {
                case "BANNED_IP":
                    $state.go("app.bannedip", { bannedIp: error.data });
                    break;

                case "SHA_512":
                    return dialogService.alert({
                        title: $translate.instant("SETUP_LOGIN_FAILED"),
                        bodyHtml: $sce.trustAsHtml($translate.instant("MSG_UPGRADE_REQUIRED"))
                    });
                    break;

                case "2FA_MISSING":
                    return dialogService.prompt($translate.instant("SETUP_LOGIN"), $translate.instant("MSG_MISSING_TWO_FACTOR_TOKEN"))
                        .result
                        .then(function(token) {
                                twoFactorToken = token;
                                return login();
                            }, function(e) {
                                $scope.isLoading = false;
                                throw e;
                            }
                        );
                    break;

                case "2FA_INVALID":
                    return dialogService.prompt($translate.instant("SETUP_LOGIN"), $translate.instant("MSG_INCORRECT_TWO_FACTOR_TOKEN"))
                        .result
                        .then(function(token) {
                                twoFactorToken = token;
                                return login();
                            }, function(e) {
                                $scope.isLoading = false;
                                throw e;
                            }
                        );
                    break;

                case "MSG_BAD_LOGIN":
                    $scope.error = "MSG_BAD_LOGIN";
                    $scope.isLoading = false;
                    break;

                case "MSG_BAD_LOGIN_UNKNOWN":
                    $scope.error = "MSG_BAD_LOGIN_UNKNOWN";
                    $scope.errorDetailed = error.data;
                    $scope.isLoading = false;
                    break;
            }
        }

        /**
         * On the scope destroy handler
         */
        function onScopeDestroy() {
            // Remove existing listeners
            if(listenerForm) {
                listenerForm();
            }

            $scope.alert.dismiss();
        }
    }
})();
