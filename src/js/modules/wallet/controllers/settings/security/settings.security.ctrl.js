angular.module("blocktrail.wallet")
    .controller("SettingsSecurityCtrl", SettingsSecurityCtrl);

// TODO Review this part, decrease dependencies, create form settings service and move $http request to service
function SettingsSecurityCtrl($scope, $http, $rootScope, $q, cryptoJS, sdkService, launchService, activeWallet,
                            $translate, $timeout, $log, $sce, dialogService, accountSecurityService,
                            CONFIG, $modal, formSettingsService, passwordStrengthService, settingsService) {

    var listenerEnabled2faToggle;
    var isEnabled2fa = false;

    // TODO: Show information about email verification
    $scope.hasEmailChanged = false;
    $scope.securityInfo = {};

    $rootScope.pageTitle = 'SETTINGS';

    // this automatically updates an already open modal instead of popping a new one open
    // TODO remove it after moving modals change password, enable/disable 2FA
    $scope.alert = dialogService.alertSingleton();

    $scope.isLoading = true;

    $scope.errors = {
        email: false,
        name: false
    };

    // Methods
    $scope.onChangePassword = onChangePassword;

    formSettingsService.fetchData()
        .then(initData);
    
    /**
     * Init data
     *
     * @param data
     */
    function initData(data) {
        accountSecurityService.getInfo().then(function (info) {
            $scope.securityInfo = info;
        });

        //$scope.isEnabled2faToggle = data.isEnabled2faToggle;
        isEnabled2fa = data.isEnabled2faToggle;

        // Add watchers
        listenerEnabled2faToggle = $scope.$watch('securityInfo.metrics.twoFA', open2faModal);

        $scope.isLoading = false;
    }

    // TODO move to modal controller
    function onChangePassword() {
        launchService.getAccountInfo().then(function(accountInfo) {
            if (activeWallet._sdkWallet.walletVersion === blocktrailSDK.Wallet.WALLET_VERSION_V1) {
                throw new Error("You're using a beta wallet, can't upgrade! Contact the Blocktrail team!");
            }

            return dialogService.prompt({
                title: $translate.instant('CHANGE_PASSWORD'),
                body: $translate.instant('ENTER_CURRENT_PASSWORD'),
                input_type: 'password',
                icon: 'key'
            })
                .result
                .then(function(currentPassword) {
                    $scope.alert($translate.instant('CHANGE_PASSWORD'), $translate.instant('VERIFYING'), false);

                    return $http.post(CONFIG.API_URL + "/v1/BTC/mywallet/check", {
                        login: accountInfo.email || accountInfo.username,
                        password: cryptoJS.SHA512(currentPassword).toString()
                    })
                        .then(
                            function(result) {
                                var requires2FA = !!result.data.requires_2fa;

                                if (accountInfo.requires2FA != requires2FA) {
                                    return launchService.updateAccountInfo({requires2FA: requires2FA})
                                        .then(function(_accountInfo) {
                                            accountInfo = _accountInfo;

                                            $scope.alert.dismiss();
                                            return true;
                                        });
                                } else {
                                    $scope.alert.dismiss();
                                    return true;
                                }
                            },
                            function(error) {
                                if (error) {
                                    throw new Error('MSG_BAD_LOGIN');
                                } else {
                                    throw new Error('MSG_BAD_NETWORK');
                                }
                            }
                        )
                        .then(function() {
                            return currentPassword;
                        })
                })
                .then(function(currentPassword) {
                    return dialogService.prompt({
                        title: $translate.instant('CHANGE_PASSWORD'),
                        body: $translate.instant('ENTER_NEW_PASSWORD'),
                        input_type: 'password',
                        icon: 'key'
                    })
                        .result
                        .then(function(newPassword) {
                            return dialogService.prompt({
                                title: $translate.instant('CHANGE_PASSWORD'),
                                body: $translate.instant('ENTER_REPEAT_PASSWORD'),
                                input_type: 'password',
                                icon: 'key'
                            })
                                .result
                                .then(function(newPassword2) {
                                    if (newPassword != newPassword2) {
                                        throw new Error($translate.instant('MSG_BAD_PASSWORD_REPEAT'));
                                    }

                                    return newPassword;
                                })
                        })
                        .then(function(newPassword) {
                            return $q.when(null).then(function() {
                                if (accountInfo.requires2FA) {
                                    return dialogService.prompt({
                                        title: $translate.instant('CHANGE_PASSWORD'),
                                        body: $translate.instant('MSG_MISSING_TWO_FACTOR_TOKEN')
                                    }).result;
                                } else {
                                    return null;
                                }
                            }).then(function(twoFactorToken) {
                                $scope.alert(
                                    $translate.instant('CHANGE_PASSWORD'),
                                    $translate.instant('CHANGE_PASSWORD_WALLET_INPROGRESS'),
                                    false
                                );

                                return activeWallet.unlockWithPassword(currentPassword).then(function(wallet) {
                                    return wallet.doPasswordChange(newPassword)
                                        .then(function(r) {
                                            var newEncryptedWalletSecret = r[0];
                                            var newEncrypedWalletSecretMnemonic = r[1];

                                            // don't submit new encrypted secret if we don't have a secret
                                            var encryptedSecret = accountInfo.secret ? cryptoJS.AES.encrypt(accountInfo.secret, newPassword).toString() : null;

                                            var passwordChange = function() {

                                                return passwordStrengthService.checkPassword(newPassword, [savedSettings.username, savedSettings.email, "BTC.com", "wallet"])
                                                    .then(function(result) {
                                                        return result;
                                                    })
                                                    .then(function (result) {
                                                        return accountSecurityService.setInfo({
                                                            metrics : {
                                                                passwordScore: result.score
                                                            }
                                                        });
                                                    })
                                                    .then(function () {
                                                        return sdkService.getSdkByActiveNetwork().passwordChange(
                                                            cryptoJS.SHA512(currentPassword).toString(),
                                                            cryptoJS.SHA512(newPassword).toString(),
                                                            encryptedSecret,
                                                            twoFactorToken,
                                                            [{
                                                                identifier: wallet.identifier,
                                                                encrypted_secret: newEncryptedWalletSecret
                                                            }]
                                                        )
                                                            .then(
                                                                function() {
                                                                    $rootScope.$emit("refreshSecurityScore", {});

                                                                    wallet.encryptedSecret = newEncryptedWalletSecret;
                                                                    wallet.lock();

                                                                    launchService.storeBackupInfo({
                                                                        encryptedSecret: newEncryptedWalletSecret
                                                                    });

                                                                    return $scope.alert({
                                                                        title: $translate.instant('CHANGE_PASSWORD'),
                                                                        bodyHtml: $sce.trustAsHtml($translate.instant('CHANGE_PASSWORD_BACKUP')),
                                                                        ok: $translate.instant('BACKUP_CREATE_PDF')
                                                                    }).result.then(function() {
                                                                        var backup = new blocktrailSDK.BackupGenerator(
                                                                            wallet.identifier,
                                                                            {
                                                                                encryptedSecret: newEncrypedWalletSecretMnemonic
                                                                            },
                                                                            {},
                                                                            {
                                                                                page1: false,
                                                                                page2: true,
                                                                                page3: false
                                                                            }
                                                                        );

                                                                        try {
                                                                            backup.generatePDF(function(err, pdf) {
                                                                                if (err) {
                                                                                    $log.error(err);
                                                                                    $scope.alert({
                                                                                        title: $translate.instant('ERROR'),
                                                                                        body: "" + err
                                                                                    });
                                                                                } else {
                                                                                    pdf.save("BlockTrail Updated Recovery Data Sheet - " + wallet.identifier + ".pdf");

                                                                                    // delete all temp backup info
                                                                                    launchService.clearBackupInfo();
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            $log.error("Backup generation error", error);
                                                                        }
                                                                    });
                                                                },
                                                                function(error) {
                                                                    wallet.lock();

                                                                    if (error instanceof blocktrailSDK.WalletInvalid2FAError) {
                                                                        return dialogService.prompt({
                                                                            title: $translate.instant('CHANGE_PASSWORD'),
                                                                            body: $translate.instant('MSG_INVALID_TWO_FACTOR_TOKEN')
                                                                        })
                                                                            .result
                                                                            .then(function(_twoFactorToken) {
                                                                                twoFactorToken = _twoFactorToken;
                                                                                return passwordChange();
                                                                            })
                                                                            ;
                                                                    } else if (error) {
                                                                        throw new Error('MSG_BAD_LOGIN');
                                                                    } else {
                                                                        throw new Error('MSG_BAD_NETWORK');
                                                                    }
                                                                }
                                                            );
                                                    });
                                            };

                                            return passwordChange();
                                        });
                                });
                            });
                        });
                })
        })
            .catch(function(err) {
                if (err && err.message) {
                    $scope.alert($translate.instant('CHANGE_PASSWORD'), err.message);
                }
            })
    }

    /**
     * Open two factor authentication modal
     */
    function open2faModal(newVal, oldVal) {
        if((newVal != oldVal) && (newVal != isEnabled2fa)) {
            if (newVal) {
                enable2FA();
            } else {
                disable2FA();
            }
        }
    }

    // TODO move to modal controller
    function enable2FA() {
        var pleaseWaitDialog;

        return $q.when(null)
            .then(function() {
                // Enter password
                return dialogService.prompt({
                    title: $translate.instant('SETTINGS_2FA'),
                    subtitle: $translate.instant('SETTINGS_2FA_STEP1'),
                    body: $translate.instant('SETTINGS_2FA_STEP1_BODY'),
                    label: $translate.instant('SETTINGS_2FA_PASSWORD'),
                    input_type: 'password',
                    ok: $translate.instant('CONTINUE'),
                })
                    .result
                    .then(function(password) {
                        pleaseWaitDialog = dialogService.alert({
                            title: $translate.instant('SETTINGS_2FA'),
                            body: $translate.instant('PLEASE_WAIT'),
                            body_class: 'text-center',
                            showSpinner: true,
                            ok: false
                        });

                        return formSettingsService.sdkSetup2FA(password)
                            .then(function(result) {
                                pleaseWaitDialog.dismiss();

                                // QR code
                                return dialogService.alert({
                                    title: $translate.instant('SETTINGS_2FA'),
                                    subtitle: $translate.instant('SETTINGS_2FA_STEP2'),
                                    bodyHtml: $sce.trustAsHtml($translate.instant('SETTINGS_2FA_STEP2_BODY')),
                                    bodyExtra: $translate.instant('SETINGS_2FA_STEP2_CODE', { secret: result.secret }),
                                    ok: $translate.instant('CONTINUE'),
                                    cancel: $translate.instant('CANCEL'),
                                    qr: {
                                        correctionLevel: 7,
                                        SIZE: 225,
                                        inputMode: 'M',
                                        image: true,
                                        text: result.otp_uri
                                    }
                                })
                                    .result
                                    .then(function() {
                                        return dialogService.prompt({
                                            title: $translate.instant('SETTINGS_2FA'),
                                            subtitle: $translate.instant('SETTINGS_2FA_STEP3'),
                                            body: $translate.instant('SETTINGS_2FA_STEP3_BODY'),
                                            label: $translate.instant('TWO_FACTOR_TOKEN'),
                                            ok: $translate.instant('SETTINGS_2FA_VERIFY_TOKEN')
                                        })
                                            .result
                                            .then(function(twoFactorToken) {
                                                pleaseWaitDialog = dialogService.alert({
                                                    title: $translate.instant('SETTINGS_2FA'),
                                                    body: $translate.instant('PLEASE_WAIT'),
                                                    body_class: 'text-center',
                                                    showSpinner: true,
                                                    ok: false
                                                });

                                                return formSettingsService.sdkEnable2FA(twoFactorToken)
                                                    .then(function() {
                                                        pleaseWaitDialog.update({
                                                            title: $translate.instant('SETTINGS_2FA'),
                                                            body: $translate.instant('SETTINGS_2FA_DONE'),
                                                            body_class: 'text-center',
                                                            ok: false
                                                        });

                                                        return formSettingsService.updateLaunchService2FA($scope.securityInfo.metrics.twoFA)
                                                            .then(function () {
                                                                isEnabled2fa = $scope.isEnabled2faToggle;

                                                                launchService.updateAccountInfo({
                                                                    requires2FA: true
                                                                }).then(function () {
                                                                    $rootScope.$emit("refreshSecurityScore", {});

                                                                    $timeout(function() {
                                                                        pleaseWaitDialog.dismiss();
                                                                    }, 1000);
                                                                });
                                                            });

                                                    }, function (e) {
                                                        // Error handler for wrong two factor token
                                                        $scope.securityInfo.metrics.twoFA = isEnabled2fa;

                                                        if (pleaseWaitDialog) {
                                                            pleaseWaitDialog.dismiss();
                                                        }

                                                        dialogService.alert({
                                                            title: $translate.instant('SETTINGS_2FA'),
                                                            body: e.message || e
                                                        });
                                                    });

                                            });
                                    }, function () {
                                        // Reset for enter QR code
                                        $scope.securityInfo.metrics.twoFA = isEnabled2fa;
                                    });
                            }, function (e) {
                                // Error handler for wrong password
                                $scope.securityInfo.metrics.twoFA = isEnabled2fa;

                                if (pleaseWaitDialog) {
                                    pleaseWaitDialog.dismiss();
                                }

                                dialogService.alert({
                                    title: $translate.instant('SETTINGS_2FA'),
                                    body: e.message || e
                                });
                            });


                    }, function () {
                        // Reset for enter password
                        $scope.securityInfo.metrics.twoFA = isEnabled2fa;
                    });
            });
    }

    // TODO move to modal controller
    function disable2FA() {
        var pleaseWaitDialog;

        return $q.when(null)
            .then(function() {
                return dialogService.prompt({
                    title: $translate.instant('SETTINGS_2FA'),
                    subtitle: $translate.instant('SETTINGS_2FA_DISABLE_2FA'),
                    body: $translate.instant('SETTINGS_2FA_DISABLE_BODY'),
                    label: $translate.instant('TWO_FACTOR_TOKEN'),
                    ok: $translate.instant('SETTINGS_2FA_DISABLE_2FA')
                })
                    .result
                    .then(function(twoFactorToken) {
                        pleaseWaitDialog = dialogService.alert({
                            title: $translate.instant('SETTINGS_2FA'),
                            body: $translate.instant('PLEASE_WAIT'),
                            body_class: 'text-center',
                            showSpinner: true,
                            ok: false
                        });

                        return formSettingsService.sdkDisable2FA(twoFactorToken)
                            .then(function() {
                                pleaseWaitDialog.update({
                                    title: $translate.instant('SETTINGS_2FA'),
                                    body: $translate.instant('SETTINGS_2FA_DISABLE_DONE'),
                                    body_class: 'text-center',
                                    ok: false
                                });

                                return formSettingsService.updateLaunchService2FA($scope.securityInfo.metrics.twoFA)
                                    .then(function () {
                                        isEnabled2fa = $scope.securityInfo.metrics.twoFA;

                                        launchService.updateAccountInfo({
                                            requires2FA: false
                                        }).then(function () {
                                            $rootScope.$emit("refreshSecurityScore", {});

                                            $timeout(function() {
                                                pleaseWaitDialog.dismiss();
                                            }, 1500);
                                        });
                                    });
                            }, function (e) {
                                // Error handler for wrong two factor token
                                $scope.securityInfo.metrics.twoFA = isEnabled2fa;

                                if (pleaseWaitDialog) {
                                    pleaseWaitDialog.dismiss();
                                }

                                dialogService.alert({
                                    title: $translate.instant('SETTINGS_2FA'),
                                    body: e.message || e
                                });
                            });
                    }, function() {
                        // Reset for enter two factor token
                        $scope.securityInfo.metrics.twoFA = isEnabled2fa;
                    });
            });
    }

    $scope.verifyEmail = function () {
        var settings = settingsService.getReadOnlySettingsData();

        var sdk = activeWallet.getSdkWallet().sdk;

        if (!settings.verifiedEmail) {
            return sdk.requestVerificationEmail()
                .then(function (result) {
                    // err handling
                    if (!result) {
                        return dialogService.alert(
                            "Oopss",
                            "We've failed sending you a verification email to your email inbox."
                        ).result;
                    }

                    return dialogService.alert(
                        "Check your inbox",
                        "We've sent you a verification email to your email inbox."
                    ).result
                });
        } else {
            return dialogService.alert(
                "Nothing to do",
                "Your email is already verified."
            ).result
        }
    };

    $scope.$on('$destroy', function() {
        if(listenerEnabled2faToggle) {
            listenerEnabled2faToggle()
        }
    });
}