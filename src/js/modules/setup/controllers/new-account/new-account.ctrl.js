(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupNewAccountCtrl", SetupNewAccountCtrl);

    function SetupNewAccountCtrl($scope, $rootScope, $state, $q, $http, $timeout, cryptoJS, launchService, CONFIG,
             setupService, dialogService, $translate, $log, PasswordStrength, $filter, powtchaService, trackingService) {
        // display mobile app download popup
        $scope.showMobileDialogOnce();

        var powtchaPromise;
        var refreshPowtchaPromise = function() {
            powtchaPromise = powtchaService.newPoWtcha();
            powtchaPromise.then(function(powtcha) {
                powtcha.startingWorkingBG();
            });
        };
        refreshPowtchaPromise();

        $scope.usernameTaken = null;
        $scope.termsofservice = false;
        $scope.working = false;
        $scope.errMsg = false;
        $scope.form = {
            username: null,
            email: null,
            password: null,
            registerWithEmail: 1, //can't use bool, must be number equivalent
            passwordCheck: null
        };

        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();
        $scope.$on("$destroy", function() {
            $scope.alert.dismiss();
        });

        $scope.toLogin = function() {
            $state.go("app.setup.login");
        };

        $scope.checkPassword = function() {
            if (!$scope.form.password) {
                $scope.passwordCheck = null;
                return $q.when(false);
            }

            return PasswordStrength.check($scope.form.password, [$scope.form.username, $scope.form.email, "BTC.com", "wallet"])
                .then(function(result) {
                    result.duration = $filter("duration")(result.crack_times_seconds.online_no_throttling_10_per_second * 1000);
                    $scope.form.passwordCheck = result;

                    return result;
                });
        };

        $scope.checkUsername = function() {
            if (!$scope.form.username) {
                //invalid
                $scope.usernameTaken = null;
                return false;
            }
            $scope.usernameTaken = null;
            $scope.checkingUsername = true;

            return $http.post(CONFIG.API_URL + "/v1/BTC/mywallet/account-available", {username: $scope.form.username}).then(
                function(response) {
                    $scope.usernameTaken = response.data;
                    $scope.checkingUsername = false;
                },
                function(error) {}
            );
        };

        $scope.doRegister = function() {
            if ($scope.working) {
                return false;
            }
            $scope.errMsg = false;
            //validate
            if (!$scope.form.registerWithEmail && (!$scope.form.username || $scope.form.username.trim().length < 4)) {
                $scope.errMsg = "MSG_BAD_USERNAME";
                return false;
            }
            if ($scope.form.registerWithEmail && !$scope.form.email) {
                $scope.errMsg = "MSG_BAD_EMAIL";
                return false;
            }
            if (!$scope.form.password) {
                $scope.errMsg = "MSG_BAD_PASSWORD";
                return false;
            }
            if (!$scope.termsofservice) {
                $scope.errMsg = "MSG_BAD_LEGAL";
                return false;
            }

            //confirm their password
            return $scope.checkPassword()
                .then(function(passwordCheck) {
                    if (!passwordCheck || passwordCheck.score < CONFIG.REQUIRED_PASSWORD_STRENGTH) {
                        $scope.errMsg = "MSG_WEAK_PASSWORD";
                        return false;
                    }

                    return dialogService.prompt({
                        title: $translate.instant("MSG_REPEAT_PASSWORD"),
                        body: $translate.instant("SETUP_PASSWORD_REPEAT_PLACEHOLDER"),
                        input_type: "password",
                        icon: "key"
                    }).result
                        .then(
                            function(dialogResult) {
                                if ($scope.form.password === dialogResult.trim()) {
                                    $scope.working = true;

                                    $scope.register();
                                } else {
                                    $scope.errMsg = "MSG_BAD_PASSWORD_REPEAT";
                                }
                            }
                        );
                });

        };

        $scope.register = function() {
            powtchaPromise.then(function(powtcha) {
                return powtcha.findNonce().then(function(powtchaResult) {
                    return trackingService.getBrowserFingerprint().then(function(fingerprint) {
                        return fingerprint.hash;
                    }, function() {
                        // if fingerprint fails we just leave it NULL
                        return null;
                    }).then(function(fingerprint) {
                        return $scope._register(powtchaResult, fingerprint);
                    });
                });
            });
        };

        $scope._register = function(powtchaResult, fingerprint) {
            var postData = {
                username: $scope.form.username,
                email: $scope.form.email,
                password: cryptoJS.SHA512($scope.form.password).toString(),
                password_score: $scope.form.passwordCheck && $scope.form.passwordCheck.score || 0,
                platform: "Web",
                version: $rootScope.appVersion,
                device_name: navigator.userAgent || "Unknown Browser",
                super_secret: CONFIG.SUPER_SECRET || null,
                powtcha: powtchaResult || null,
                browser_fingerprint: fingerprint || null
            };

            $http.post(CONFIG.API_URL + "/v1/BTC/mywallet/register", postData)
                .then(function(result) {
                        return launchService.storeAccountInfo(result.data).then(function() {
                            // TODO Add network type
                            $scope.setupInfo.password = $scope.form.password;

                            $scope.working = false;

                            // save the default settings
                            setupService.setUserInfo({
                                username: $scope.form.username,
                                displayName: $scope.form.username,
                                email: $scope.form.email
                            });

                            $timeout(function() {
                                $state.go('app.setup.wallet');
                            }, 200);
                        });
                    },
                    function(error) {
                        refreshPowtchaPromise();
                        $log.error(error);
                        $scope.working = false;

                        if (error.data.msg.toLowerCase().match(/username exists/)) {
                            $scope.errMsg = "MSG_USERNAME_TAKEN";
                        } else if (error.data.msg.toLowerCase().match(/already in use/)) {
                            $scope.errMsg = "MSG_EMAIL_TAKEN";
                        } else {
                            $scope.errMsg = error.data.msg;
                        }
                    });
        };
    }
})();
