(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupChangePasswordCtrl", SetupChangePasswordCtrl);

    function SetupChangePasswordCtrl($scope, $stateParams, $http, $q, $sce, passwordStrengthService, dialogService, $log, $filter,
                                     sdkService, $translate, CONFIG, passwordRecoveryService) {

        $scope.bip39EN = blocktrailSDK.bip39wordlist;
        $scope.stepCount = 0;
        $scope.working = false;
        $scope.error = null;
        $scope.form = {
            email : "",
            ERS: "",
            newPassword: "",
            newPasswordRepeat: "",
            passwordCheck: null
        };

        $scope.walletVersions = ["v1", "v2", "v3"];

        // Password reset data
        var secret = null;
        var twoFactorToken = null;

        // Get state parameters
        var token = $stateParams.token;
        var walletVersion = $stateParams.version;
        var requires2FA = $stateParams.requires_2fa === "1";

        var recoverySecret = passwordRecoveryService.requestRecoverySecret(token);

        var watchListenerERS = $scope.$watch('form.ERS', function (newVal, oldVal) {
            function strcmp (a, b) {
                return (a < b ? -1 : ( a > b ? 1 : 0 ));
            }
            // Remove line breaks
            if ($scope.form.ERS && $scope.form.ERS.length > 0) {
                $scope.form.ERS = $scope.form.ERS.replace(/[\r\n]+/g, " "); // https://stackoverflow.com/a/34936253
            }

            if (newVal && oldVal) {
                var oldWords = oldVal.split(' ');
                // If we add a word
                if (newVal.split(' ').length == 1 && oldWords.length > 1) {
                    delete oldWords[oldWords.length - 1];
                    // Special case when removing last word
                    if (strcmp(oldVal, newVal + ' ' + newVal[0])) {
                        $scope.form.ERS = oldWords.join(' ') + newVal + ' ';
                    } else {
                        $scope.form.ERS = oldWords.join(' ').slice(0, -1);
                    }
                }
            }
        });

        $scope.checkPassword = function () {
            if($scope.form.newPassword !== $scope.form.newPasswordRepeat) {
                $scope.form.passwordCheck = {score: -1};
                return $q.when(false);
            }

            if (!$scope.form.newPassword || !$scope.form.newPasswordRepeat) {
                $scope.form.passwordCheck = null;
                return $q.when(false);
            }

            return passwordStrengthService.checkPassword($scope.form.newPassword, [$scope.form.email, "BTC.com", "wallet"])
                .then(function(result) {
                    result.duration = $filter("duration")(result.crack_times_seconds.online_no_throttling_10_per_second * 1000);
                    $scope.form.passwordCheck = result;
                    return result;
                });
        };

        function generateBackupPageTwo (identifier, newEncryptedWalletSecretMnemonic) {
            return dialogService.alert({
                title: $translate.instant('CHANGE_PASSWORD'),
                bodyHtml: $sce.trustAsHtml($translate.instant('CHANGE_PASSWORD_BACKUP')),
                ok: $translate.instant('BACKUP_DOWNLOAD_ADDITIONAL_PAGE_PDF')
            }).result.then(function () {
                var backup = new blocktrailSDK.BackupGenerator(
                    identifier,
                    {
                        encryptedSecret: newEncryptedWalletSecretMnemonic
                    },
                    {},
                    {
                        page1: false,
                        page2: true,
                        page3: false
                    }
                );

                try {
                    backup.generatePDF (function(err, pdf) {
                        if (err) {
                            $log.error(err);
                            $scope.alert({
                                title: $translate.instant('ERROR'),
                                body: "" + err
                            });
                        } else {
                            pdf.save("BlockTrail Additional Recovery Data Sheet - " + identifier + ".pdf");
                        }
                    });
                } catch (error) {
                    $log.error("Backup generation error", error);
                }
            });
        }

        function askFor2FA () {
            return dialogService.prompt(
                $translate.instant("SETUP_LOGIN"),
                $translate.instant("MSG_MISSING_TWO_FACTOR_TOKEN")
            ).result.then(function (result) {
                twoFactorToken = result;
            });
        }

        $scope.encryptNewERS = function() {
            $scope.checkPassword().then(function (result) {
                if (result === false) {
                    return dialogService.alert(
                        $translate.instant("RECOVERY_ERROR"),
                        $translate.instant("MSG_BAD_PASSWORD_REPEAT")
                    ).result;
                } else if (result.score < CONFIG.REQUIRED_PASSWORD_STRENGTH) {
                    return dialogService.alert(
                        $translate.instant("RECOVERY_ERROR"),
                        $translate.instant("MSG_WEAK_PASSWORD")
                    ).result;
                }
                // If 2FA is required, ask for and and then continue
                else if (requires2FA && !twoFactorToken) {
                    return askFor2FA().then(function () {
                        $scope.encryptNewERS();
                    });
                } else {
                    console.log("before encrypted data, the walletVersion:",walletVersion);
                    // Encrypt secret with new Password, generate mnemonic and password hash
                    var encryptedData = passwordRecoveryService.encryptSecretWithPassword(secret, $scope.form.newPassword, walletVersion);

                    // Create data object
                    var data = {
                        token: token,
                        new_password_hash: encryptedData.password_hash,
                        new_encrypted_secret: encryptedData.encrypted_secret,
                        password_score: result.score
                    };

                    if(requires2FA && twoFactorToken) {
                        data['two_factor_token'] = twoFactorToken;
                    }

                    $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/recovery/change-password", data).then(function (res) {
                        // Generate backup PDF
                        generateBackupPageTwo("", encryptedData.secret_mnemonic);
                        $scope.stepCount = 2;
                    }, function (err) {
                        // Error handling
                        twoFactorToken = null; // Clear the used 2FA token
                        if (err.data && err.data.msg && err.data.msg === "invalid recovery token") {
                            return dialogService.alert(
                                $translate.instant("INVALID_RECOVERY_TOKEN"),
                                $translate.instant("MSG_INVALID_RECOVER_TOKEN")
                            ).result;
                        } else if (err.data && err.data.msg && err.data.msg === "invalid 2FA token") {
                            twoFactorToken = null;
                            return dialogService.alert(
                                $translate.instant("BAD_TOKEN"),
                                $translate.instant("MSG_BAD_TOKEN")
                            ).result;
                        } else {
                            return dialogService.alert(
                                $translate.instant("RECOVERY_ERROR"),
                                $translate.instant("MSG_CHANGE_PASSWORD_UNKNOWN_ERROR")
                            ).result;
                        }
                    });
                }
            });
        };

        $scope.decryptERS = function() {
            if ($scope.working) {
                return false;
            }
            $scope.error = null;
            $scope.working = true;

            if ($scope.form.ERS.length > 0) {
                recoverySecret.then(function(recoverySecret) {
                    try {
                        recoverySecret = recoverySecret.trim();
                        var encryptedRecoverySecretMnemonic = $scope.form.ERS
                            .trim()
                            .replace(new RegExp("\r\n", 'g'), " ")
                            .replace(new RegExp("\n", 'g'), " ")
                            .replace(/\s\s+/g, " ")
                            .replace("[ \t]+$", "");

                        if ($scope.walletVersions.indexOf(walletVersion) < 0) {
                            $scope.working = false;
                            return dialogService.alert(
                                $translate.instant("INVALID_WALLET_VERSION"),
                                $translate.instant("MSG_INVALID_WALLET_VERSION")
                            ).result;
                        }

                        if (recoverySecret.length !== 64) {
                            $scope.working = false;
                            return dialogService.alert(
                                $translate.instant("RECOVERY_ERROR"),
                                $translate.instant("MSG_CORRUPTED_SECRET")
                            ).result;
                        }

                        // Try decrypting
                        try {
                            console.log("before decrypt, the walletBersion:",walletVersion);
                            var decrypt = passwordRecoveryService.decryptSecretMnemonicWithPassword(encryptedRecoverySecretMnemonic, recoverySecret, walletVersion);
                            secret = decrypt[0];
                            var decryptVersion = decrypt[1];
                            walletVersion = decryptVersion;
                            console.log("decryptSecretMnemonicWithPassword secret:",secret);
                            console.log("after decrypt, the walletBersion:",walletVersion);
                        } catch (e) {
                            $log.error(e, e.message);
                            $scope.working = false;
                            return dialogService.alert(
                                $translate.instant("RECOVERY_ERROR"),
                                $translate.instant("MSG_RECOVERY_DECRYPT_FAILED")
                            ).result;
                        }

                        watchListenerERS();
                        $scope.stepCount = 1;
                        $scope.working = false;
                    } catch (e) {
                        $scope.working = false;
                        $log.error(e, e.message);
                    }
                });
            }
        };
    }
})();
