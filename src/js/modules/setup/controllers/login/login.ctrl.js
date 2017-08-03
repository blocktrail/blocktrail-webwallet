(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupLoginCtrl", SetupLoginCtrl);

    // TODO Review this part, decrease dependencies, create login service and move $http request to service
    function SetupLoginCtrl($rootScope, $scope, $state, $sce, $translate, $log, $q, $http, _, cryptoJS, CONFIG,
                            launchService, setupService, dialogService, FormHelper) {
        // display mobile app download popup
        $scope.showMobileDialogOnce();

        $scope.twoFactorToken = null;
        $scope.working = false;
        $scope.form = {
            username: "",
            password: "",
            forceNewWallet: false
        };
        $scope.error = null;
        $scope.errorDetailed = null;
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();

        $scope.$watch("form", function() {
            $scope.error = null;
            $scope.errorDetailed = null;
        }, true);

        $scope.$on("$destroy", function() {
            $scope.alert.dismiss();
        });

        $scope.doLogin = function(loginForm) {
            if ($scope.working) {
                return false;
            }

            $scope.error = null;
            $scope.errorDetailed = null;

            FormHelper.setAllDirty(loginForm);

            if (loginForm.$invalid) {
                return false;
            }

            $scope.working = true;
            $scope.login();
        };

        $scope.login = function() {
            var twoFactorToken = $scope.twoFactorToken;
            $scope.twoFactorToken = null; // consumed

            $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "t" : "") + CONFIG.NETWORK + "/mywallet/enable", {
                login: $scope.form.username,
                password: cryptoJS.SHA512($scope.form.password).toString(),
                platform: "Web",
                version: $rootScope.appVersion,
                two_factor_token: twoFactorToken,
                device_name: navigator.userAgent || "Unknown Browser"
            }).then(
                function(result) {
                    $q.when(result.data.encrypted_secret)
                        .then(function(encryptedSecret) {
                            if (!encryptedSecret) {
                                return null;
                            } else {
                                var secret;
                                try {
                                    secret = cryptoJS.AES.decrypt(encryptedSecret, $scope.form.password).toString(cryptoJS.enc.Utf8);
                                } catch (e) {
                                    $log.error(e);
                                    secret = null;
                                }

                                // @TODO: we should have a checksum
                                if (!secret || secret.length != 44) {
                                    $log.error("failed to decrypt encryptedSecret");
                                    secret = null;
                                }

                                return secret;
                            }
                        })
                        .then(function(secret) {
                            return launchService.storeAccountInfo(_.merge({}, {secret: secret}, result.data)).then(function() {
                                $log.debug("existing_wallet", result.data.existing_wallet);
                                $log.debug("forceNewWallet", $scope.form.forceNewWallet);

                                if (!$scope.form.forceNewWallet) {
                                    $scope.setupInfo.identifier = result.data.existing_wallet || $scope.setupInfo.identifier;
                                }
                                $scope.setupInfo.password = $scope.form.password;

                                // save the default settings
                                setupService.setUserInfo({
                                    username: $scope.form.username || result.data.username,
                                    displayName: $scope.form.username || result.data.username,
                                    email: $scope.form.email || result.data.email
                                });

                                $state.go('app.setup.wallet');
                            });
                        })
                    ;
                },
                function(error) {
                    $scope.working = false;

                    if (error.data) {
                        error = blocktrailSDK.Request.handleFailure(error.data);

                        if (error.is_banned) {
                            return $state.go("app.bannedip", {bannedIp: error.is_banned});

                        } else if (error.requires_sha512) {
                            return dialogService.alert({
                                title: $translate.instant("SETUP_LOGIN_FAILED"),
                                bodyHtml: $sce.trustAsHtml($translate.instant("MSG_UPGRADE_REQUIRED"))
                            });

                        } else if (error instanceof blocktrailSDK.WalletMissing2FAError) {
                            return dialogService.prompt(
                                $translate.instant("SETUP_LOGIN"),
                                $translate.instant("MSG_MISSING_TWO_FACTOR_TOKEN")
                            )
                                .result
                                .then(
                                    function(twoFactorToken) {
                                        $scope.twoFactorToken = twoFactorToken;

                                        return $scope.login();
                                    },
                                    function(e) {
                                        $scope.working = false;

                                        throw e;
                                    }
                                )
                                ;
                        } else if (error instanceof blocktrailSDK.WalletInvalid2FAError) {
                            return dialogService.prompt(
                                $translate.instant("SETUP_LOGIN"),
                                $translate.instant("MSG_INCORRECT_TWO_FACTOR_TOKEN")
                            )
                                .result
                                .then(
                                    function(twoFactorToken) {
                                        $scope.twoFactorToken = twoFactorToken;

                                        return $scope.login();
                                    },
                                    function(e) {
                                        $scope.working = false;

                                        throw e;
                                    }
                                )
                                ;
                        } else {
                            $scope.error = "MSG_BAD_LOGIN";
                        }

                    } else if(error) {
                        console.log(error);
                        $scope.error = "MSG_BAD_LOGIN_UNKNOWN";
                        $scope.errorDetailed = "" + (error.message || error.msg || error);
                        if ($scope.errorDetailed === ("" + {})) {
                            $scope.errorDetailed = null;
                        }
                    } else {
                        $scope.error = "MSG_BAD_NETWORK";
                    }

                    throw error;
                }
            );
        };
    }
})();
