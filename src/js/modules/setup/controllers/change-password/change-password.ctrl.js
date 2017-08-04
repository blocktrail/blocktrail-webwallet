(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupChangePasswordCtrl", SetupChangePasswordCtrl);

    function SetupChangePasswordCtrl($scope, $stateParams, $http, $q, $sce, PasswordStrength, dialogService, $log, $filter, sdkService, $translate, CONFIG) {

        var bip39EN = blocktrailSDK.bip39wordlist;

        $scope.working  = false;
        $scope.error    = null;
        $scope.form     = {
            email : null,
            ERS: null,
            newPassword: null,
            newPasswordRepeat: null,
            passwordCheck: null
        };

        $scope.walletVersions = ["v1", "v2", "v3"];

        $scope.bip39EN = bip39EN;
        $scope.stepCount = 0;

        /* Password reset data */
        var secret = null;
        var twoFactorToken = null;

        var token = null;
        var recoverySecret = null;
        var walletVersion = null;
        var requires2FA = null;

        // Get state parameters
        token = $stateParams.token;
        recoverySecret = $stateParams.recovery;
        walletVersion = $stateParams.version;
        requires2FA = $stateParams.requires_2fa;
        // ----

        var watchListener = $scope.$watch('form.ERS', function (newVal, oldVal) {
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

            return PasswordStrength.check($scope.form.newPassword, [$scope.form.email, "BTC.com", "wallet"])
                .then(function(result) {
                    result.duration = $filter("duration")(result.crack_times_seconds.online_no_throttling_10_per_second * 1000);
                    $scope.form.passwordCheck = result;
                    return result;
                });
        };

        $scope.changeWalletVersion = function (version) {
            $scope.form.walletVersion = version;
        };

        function generateBackupPageTwo (identifier, newEncryptedWalletSecretMnemonic) {
            return dialogService.alert({
                title: $translate.instant('CHANGE_PASSWORD'),
                bodyHtml: $sce.trustAsHtml($translate.instant('CHANGE_PASSWORD_BACKUP')),
                ok: $translate.instant('BACKUP_DOWNLOAD_ADDITIONAL_PAGE_PDF')
            }).result.then(function () {
                var backup = new sdkService.BackupGenerator(
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

                            // delete all temp backup info
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

            var convert = function(s, from, to) {
                return (new Buffer(s, from)).toString(to);
            };

            // If 2FA is required, ask for and and then continue
            if (requires2FA == true && twoFactorToken == null) {
                return askFor2FA().then(function () {
                    $scope.encryptNewERS();
                });
            } else {
                var newEncryptedSecret;
                var newEncryptedWalletSecretMnemonic;
                var newPasswordHash;
                var newPasswordBuffer = null;

                if (walletVersion === blocktrailSDK.Wallet.WALLET_VERSION_V2) {
                    newEncryptedSecret = blocktrailSDK.CryptoJS.AES.encrypt(secret, $scope.form.newPassword).toString(blocktrailSDK.CryptoJS.format.OpenSSL);
                    newEncryptedWalletSecretMnemonic = blocktrailSDK.bip39.entropyToMnemonic(convert(newEncryptedSecret, 'base64', 'hex'));

                } else {
                    if (typeof $scope.form.newPassword === "string") {
                        newPasswordBuffer = new blocktrailSDK.Buffer($scope.form.newPassword);
                    } else {
                        if (!(newPasswordBuffer instanceof blocktrailSDK.Buffer)) {
                            throw new Error('New password must be provided as a string or a Buffer');
                        }
                    }
                    newEncryptedSecret = blocktrailSDK.Encryption.encrypt(secret, newPasswordBuffer);
                    newEncryptedWalletSecretMnemonic = blocktrailSDK.EncryptionMnemonic.encode(newEncryptedSecret);
                    // It's a buffer, so convert it back to base64
                    newEncryptedSecret = newEncryptedSecret.toString('base64');
                }//else

                newPasswordHash = blocktrailSDK.CryptoJS.SHA512($scope.form.newPassword).toString();

                // Create response data object
                var response = {
                    token: token,
                    new_password_hash: newPasswordHash,
                    new_encrypted_secret: newEncryptedSecret
                };

                if(requires2FA && twoFactorToken) {
                    response['two_factor_token'] = twoFactorToken;
                }

                // Post it
                $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "tBTC" : "BTC") + "/recovery/change-password", response).then(function (res) {
                    // Generate backup PDF
                    generateBackupPageTwo("", newEncryptedWalletSecretMnemonic);
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
                            $translate.instant("MSG_PASSWORD_NOT_CHANGED")
                        ).result;
                    }
                });
            }
        };

        $scope.decryptERS = function() {

            if ($scope.working) {
                return false;
            }
            $scope.error = null;

            $scope.working = true;

            if ($scope.form.ERS.length > 0) {
                try {
                    recoverySecret = recoverySecret.trim();
                    var encryptedRecoverySecretMnemonic = $scope.form.ERS
                        .trim()
                        .replace(new RegExp("\r\n", 'g'), " ")
                        .replace(new RegExp("\n", 'g'), " ")
                        .replace(/\s\s+/g, " ")
                        .replace("[ \t]+$", "");
                    var encryptedRecoverySecret = null;

                    if ($scope.walletVersions.indexOf(walletVersion) < 0) {
                        $scope.working = false;
                        return dialogService.alert(
                            $translate.instant("INVALID_WALLET_VERSION"),
                            $translate.instant("MSG_INVALID_WALLET_VERSION")
                        ).result;
                    }

                    if (recoverySecret.length != 64) {
                        $scope.working = false;
                        return dialogService.alert(
                            $translate.instant("RECOVERY_ERROR"),
                            $translate.instant("MSG_CORRUPTED_SECRET")
                        ).result;
                    }

                    if ($scope.form.ERS.split(' ').length != 60) {
                        $scope.working = false;
                        return dialogService.alert(
                            $translate.instant("RECOVERY_ERROR"),
                            $translate.instant("MSG_WRONG_ERS_WORD_LENGTH")
                        ).result;
                    }

                    // Try decrypting
                    try {
                        if (walletVersion === 'v3') {
                            encryptedRecoverySecret = blocktrailSDK.EncryptionMnemonic.decode(encryptedRecoverySecretMnemonic);
                            secret = blocktrailSDK.Encryption.decrypt(encryptedRecoverySecret, new blocktrailSDK.Buffer(recoverySecret, 'hex'));

                        } else {
                            // TODO: test with v2
                            encryptedRecoverySecret = blocktrailSDK.convert(blocktrailSDK.bip39.mnemonicToEntropy(encryptedRecoverySecretMnemonic), 'hex', 'base64');
                            secret = CryptoJS.AES.decrypt(encryptedRecoverySecret, recoverySecret).toString(CryptoJS.enc.Utf8);
                        }
                    } catch (e) {
                        $log.error(e, e.message);
                        $scope.working = false;
                        return dialogService.alert(
                            $translate.instant("RECOVERY_ERROR"),
                            $translate.instant("MSG_PASSWORD_NOT_CHANGED")
                        ).result;
                    }

                    watchListener();
                    console.log(secret);
                    $scope.stepCount = 1;
                    $scope.working = false;
                } catch (e) {
                    $scope.working = false;
                    $log.error(e, e.message);
                }
            }
        };
    }

    angular.module("blocktrail.setup").filter('filterERS', function () {

        function handler(bip39EN, input) {

            var words = input.split(' ');
            input = words[words.length - 1];

            return bip39EN.filter(function (currElement) {
                return currElement.indexOf(input) == 0;
            });
        }

        return handler;
    });
})();
