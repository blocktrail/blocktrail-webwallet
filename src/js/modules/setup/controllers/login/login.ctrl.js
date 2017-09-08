(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupLoginCtrl", SetupLoginCtrl);

    function SetupLoginCtrl($scope, $state, $sce, CONFIG, dialogService, FormHelper, loginFormService, sdkService) {
        var listenerForm;
        var twoFactorToken = null;

        // display mobile app download popup
        $scope.showMobileDialogOnce();
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();


        $scope.isDebugMode = CONFIG.DEBUG;
        $scope.isLoading = false;
        $scope.form = {
            username: "",
            password: "",
            forceNewWallet: false,
            networkType: CONFIG.NETWORKS_ENABLED[0]
        };
        $scope.networkTypes = getNetworkTypes();

        $scope.error = null;
        $scope.errorDetailed = null;

        listenerForm = $scope.$watch("form", onFormChange, true);

        // Set default network
        sdkService.setNetworkType($scope.form.networkType);

        // Methods
        $scope.onSubmitFormLogin = onSubmitFormLogin;

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

        function loginFormSuccessHandler(data) {
            if (!$scope.form.forceNewWallet) {
                $scope.setupInfo.identifier = data.existing_wallet || $scope.setupInfo.identifier;
            }

            $scope.setupInfo.password = $scope.form.password;
            $scope.setupInfo.network = $scope.form.network;

            $state.go('app.setup.wallet');
        }

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
                    break;

                case "MSG_BAD_LOGIN_UNKNOWN":
                    $scope.error = "MSG_BAD_LOGIN_UNKNOWN";
                    $scope.errorDetailed = error.data;
                    break;
            }
        }

        function onFormChange(newValue, oldValue) {
            $scope.error = null;
            $scope.errorDetailed = null;

            if(newValue.networkType !== oldValue.networkType) {
                sdkService.setNetworkType(newValue.networkType);
            }
        }

        $scope.$on('$destroy', function() {
            // Remove existing listeners
            if(listenerForm) {
                listenerForm();
            }

            $scope.alert.dismiss();
        });
    }
})();
