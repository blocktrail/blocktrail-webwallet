angular.module('blocktrail.wallet')
    .controller('SettingsCtrl', function($scope, $http, $rootScope, $q, sdkService, launchService, settingsService, Wallet,
                                         Contacts, storageService, $translate, $timeout, $state, $log, $sce, dialogService,
                                         CONFIG, $modal, blocktrailLocalisation) {
        $rootScope.pageTitle = 'SETTINGS';

        $scope.profilePic = {
            newProfileImage: null,
            croppedProfileImage: null,
            working: false,
            cropping: false,
            saved: false
        };

        var updateLanguages = function() {
            $scope.languages = blocktrailLocalisation.getLanguages().map(function(language) {
                var name = blocktrailLocalisation.languageName(language);
                return name ? {code: language, name: name} : null;
            }).clean();
        };

        updateLanguages();
        $rootScope.fetchExtraLanguages.then(function() {
            updateLanguages();
        });

        $scope.$storingSettings = $q.when(null);
        $scope.settingsSaved = null;

        $scope.$on('fileUpload:start', function(event, name) {
            if (name !== "profilePic") return;

            $scope.$apply(function() {
                $scope.profilePic.working = true;
            });
        });
        $scope.$on('fileUpload:done', function(event, name, data) {
            if (name !== "profilePic") return;

            $scope.$apply(function() {
                $scope.profilePic.cropping = true;
                $scope.profilePic.newProfileImage = data;

                $modal.open({
                    controller: 'CropImageCtrl',
                    templateUrl: 'templates/settings/dialog.crop-image.html',
                    windowClass: 'modal-max-height',
                    size: 'lg',
                    backdrop: 'static',
                    scope: $scope
                }).result
                    .then(
                        function() {
                            settingsService.profilePic = $scope.profilePic.croppedProfileImage;
                            $scope.profilePic.newProfileImage = null;
                            $scope.profilePic.saved = true;
                            $scope.profilePic.cropping = false;
                            $scope.profilePic.working = false;
                            $scope.$storingSettings = $scope.$storingSettings.then(function() {
                                settingsService.$store().then(function() {
                                    // try to update the server with the new profile
                                    settingsService.$syncProfileUp();

                                    $timeout(function() {
                                        $scope.profilePic.saved = false;
                                    }, 5000);
                                });
                            });
                        },
                        function() {
                            $scope.profilePic.newProfileImage = null;
                            $scope.profilePic.cropping = false;
                            $scope.profilePic.working = false;
                        }
                    )
                ;
            });
        });

        $scope.allData = $q.all([
            launchService.getWalletInfo()
        ]).then(function(data) {
            //$scope.settings = data[0];
            $scope.defaultWallet = data[0].identifier;
            return data;
        });

        $scope.enabled2fa = null;
        $scope.enabled2faToggle = null;
        launchService.getAccountInfo().then(function(accountInfo) {
            $scope.enabled2fa = accountInfo.requires2FA;
            $scope.enabled2faToggle = $scope.enabled2fa;
        });

        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();
        $scope.$on('$destroy', function() {
            $scope.alert.dismiss();
        });

        /**
         * delete all local data and start again from scratch. Requires PIN to do
         */
        $scope.resetWallet = function() {
                return dialogService.alert(
                    $translate.instant('MSG_RESET_WALLET').capitalize(),
                    $translate.instant('MSG_ARE_YOU_SURE').capitalize(),
                    null,
                    null // enable cancel button
                )
                    .result
                    .then(function() {
                        //destroy EVERYTHING!!!!
                        $log.debug('Resetting wallet');
                        return storageService.resetAll()
                            .then(function() {
                                window.location.replace('');
                            })
                        ;
                    })
                    .catch(function(err) {
                        // modal.dismiss will be err=undefined
                        if (err) {
                            dialogService.alert(err.toString(), $translate.instant('FAILED').capitalize());
                        }
                    })
                ;
        };

        $scope.updateSettings = function() {
            $scope.savingSettings = true;

            $rootScope.changeLanguage(settingsService.language);

            // chain on $scope.$storingSettings so that any previous already saving happens first
            $scope.$storingSettings = $scope.$storingSettings.then(function() {
                return settingsService.$store();
            })
                .then(function() {
                    return settingsService.$syncSettingsUp();
                })
                .then(function() {
                    $scope.savingSettings = false;
                    $scope.settingsSaved = true;
                    $timeout(function() {
                        $scope.settingsSaved = null;
                    }, 5000);
                })
                .catch(function(e) {
                    $scope.$storingSettings = $q.when();
                    $scope.savingSettings = false;
                    $scope.settingsSaved = false;
                    $timeout(function() {
                        $scope.settingsSaved = null;
                    }, 5000);
                })
            ;

            return $scope.$storingSettings;
        };

        $scope.changePassword = function() {
            launchService.getAccountInfo().then(function(accountInfo) {
                return Wallet.wallet.then(function(wallet) {
                    if (wallet.walletVersion == blocktrailSDK.Wallet.WALLET_VERSION_V1) {
                        throw new Error("You're using a beta wallet, can't upgrade! Contact the Blocktrail team!");
                    }

                    return dialogService.prompt({
                        title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                        body: $translate.instant('ENTER_CURRENT_PASSWORD').capitalize(),
                        input_type: 'password',
                        icon: 'key'
                    })
                        .result
                        .then(function(currentPassword) {
                            $scope.alert($translate.instant('CHANGE_PASSWORD').capitalize(), $translate.instant('VERIFYING').capitalize(), false);

                            return $http.post(CONFIG.API_URL + "/v1/BTC/mywallet/check", {
                                login: accountInfo.email || accountInfo.username,
                                password: CryptoJS.SHA512(currentPassword).toString()
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
                                title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                                body: $translate.instant('ENTER_NEW_PASSWORD').sentenceCase(),
                                input_type: 'password',
                                icon: 'key'
                            })
                                .result
                                .then(function(newPassword) {
                                    return dialogService.prompt({
                                        title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                                        body: $translate.instant('ENTER_REPEAT_PASSWORD').sentenceCase(),
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
                                                title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                                                body: $translate.instant('MSG_MISSING_TWO_FACTOR_TOKEN').sentenceCase()
                                            }).result;
                                        } else {
                                            return null;
                                        }
                                    }).then(function(twoFactorToken) {
                                        $scope.alert(
                                            $translate.instant('CHANGE_PASSWORD').capitalize(),
                                            $translate.instant('CHANGE_PASSWORD_WALLET_INPROGRESS').sentenceCase(),
                                            false
                                        );

                                        return Wallet.unlockWithPassword(currentPassword).then(function(wallet) {
                                            return wallet.doPasswordChange(newPassword)
                                                .then(function(r) {
                                                    var newEncryptedWalletSecret = r[0];
                                                    var newEncrypedWalletSecretMnemonic = r[1];

                                                    return sdkService.sdk().then(function(sdk) {

                                                        // don't submit new encrypted secret if we don't have a secret
                                                        var encryptedSecret = accountInfo.secret ? CryptoJS.AES.encrypt(accountInfo.secret, newPassword).toString() : null;

                                                        var passwordChange = function() {
                                                            return sdk.passwordChange(
                                                                CryptoJS.SHA512(currentPassword).toString(),
                                                                CryptoJS.SHA512(newPassword).toString(),
                                                                encryptedSecret,
                                                                twoFactorToken,
                                                                [{
                                                                    identifier: wallet.identifier,
                                                                    encrypted_secret: newEncryptedWalletSecret
                                                                }]
                                                            )
                                                                .then(
                                                                    function() {
                                                                        wallet.encryptedSecret = newEncryptedWalletSecret;
                                                                        wallet.lock();

                                                                        launchService.storeBackupInfo({
                                                                            encryptedSecret: newEncryptedWalletSecret
                                                                        });

                                                                        return $scope.alert({
                                                                            title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                                                                            bodyHtml: $sce.trustAsHtml($translate.instant('CHANGE_PASSWORD_BACKUP').sentenceCase()),
                                                                            ok: $translate.instant('BACKUP_CREATE_PDF').capitalize()
                                                                        }).result.then(function() {
                                                                            var backup = new sdkService.BackupGenerator(
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
                                                                                title: $translate.instant('CHANGE_PASSWORD').capitalize(),
                                                                                body: $translate.instant('MSG_INVALID_TWO_FACTOR_TOKEN').capitalize()
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
                                                                )
                                                                ;
                                                        };

                                                        return passwordChange();
                                                    });
                                                });
                                        });
                                    });
                                });
                        })
                });
            })
            .catch(function(err) {
                if (err && err.message) {
                    $scope.alert($translate.instant('CHANGE_PASSWORD').capitalize(), err.message);
                }
            })
        };

        $scope.unlockWallet = function() {
             return dialogService.prompt({
                 title: $translate.instant('SETUP_WALLET_PASSWORD'),
                 input_type: 'password',
                 icon: 'key'
             })
                .result
                .then(function(password) {
                    return Wallet.unlockWithPassword(password).then(function(wallet) {
                        wallet.lock();
                        dialogService.alert("OK", "It worked!");
                    });
                })
                 .catch(function(err) {
                     if (err && err.message) {
                         dialogService.alert($translate.instant('ERROR_TITLE_1'), err.message);
                     }
                 })
            ;
        };

        $scope.resetApp = function($event) {
            storageService.resetAll().then(
                function() {
                    alert('reset!');
                    window.location.replace('');
                }
            );
        };

        $scope.$watch('enabled2faToggle', function() {
            if ($scope.enabled2faToggle !== null && $scope.enabled2faToggle != $scope.enabled2fa) {
                if ($scope.enabled2faToggle) {
                    $scope.enable2FA();
                } else if ($scope.enabled2fa) {
                    $scope.disable2FA();
                }
            }
        });

        $scope.enable2FA = function() {
            var pleaseWaitDialog;

            return $q.when(null)
                .then(function() {
                    return dialogService.prompt({
                        title: $translate.instant('SETTINGS_2FA').capitalize(),
                        subtitle: $translate.instant('SETTINGS_2FA_STEP1').capitalize(),
                        body: $translate.instant('SETTINGS_2FA_STEP1_BODY').sentenceCase(),
                        label: $translate.instant('SETTINGS_2FA_PASSWORD').capitalize(),
                        input_type: 'password',
                        ok: $translate.instant('CONTINUE').capitalize()
                    })
                        .result
                        .then(
                        function(password) {
                            pleaseWaitDialog = dialogService.alert({
                                title: $translate.instant('SETTINGS_2FA').capitalize(),
                                body: $translate.instant('PLEASE_WAIT').capitalize(),
                                body_class: 'text-center',
                                showSpinner: true,
                                ok: false
                            });

                            return sdkService.sdk().then(function(sdk) {
                                return sdk.setup2FA(CryptoJS.SHA512(password).toString()).then(function(result) {

                                    pleaseWaitDialog.dismiss();
                                    return dialogService.alert({
                                        title: $translate.instant('SETTINGS_2FA').capitalize(),
                                        subtitle: $translate.instant('SETTINGS_2FA_STEP2').capitalize(),
                                        bodyHtml: $sce.trustAsHtml($translate.instant('SETTINGS_2FA_STEP2_BODY').sentenceCase()),
                                        bodyExtra: $translate.instant('SETINGS_2FA_STEP2_CODE', {secret: result.secret}).sentenceCase(),
                                        ok: $translate.instant('CONTINUE').capitalize(),
                                        cancel: $translate.instant('CANCEL').capitalize(),
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
                                                title: $translate.instant('SETTINGS_2FA').capitalize(),
                                                subtitle: $translate.instant('SETTINGS_2FA_STEP3').capitalize(),
                                                body: $translate.instant('SETTINGS_2FA_STEP3_BODY').sentenceCase(),
                                                label: $translate.instant('TWO_FACTOR_TOKEN').capitalize(),
                                                ok: $translate.instant('SETTINGS_2FA_VERIFY_TOKEN').capitalize()
                                            })
                                                .result
                                                .then(function(twoFactorToken) {
                                                    var pleaseWaitDialog = dialogService.alert({
                                                        title: $translate.instant('SETTINGS_2FA').capitalize(),
                                                        body: $translate.instant('PLEASE_WAIT').capitalize(),
                                                        body_class: 'text-center',
                                                        showSpinner: true,
                                                        ok: false
                                                    });

                                                    return sdk.enable2FA(twoFactorToken).then(function() {
                                                        pleaseWaitDialog.update({
                                                            title: $translate.instant('SETTINGS_2FA').capitalize(),
                                                            body: $translate.instant('SETTINGS_2FA_DONE').capitalize(),
                                                            body_class: 'text-center',
                                                            ok: false
                                                        });

                                                        return launchService.getAccountInfo().then(function(accountInfo) {
                                                            accountInfo.requires2FA = true;

                                                            return launchService.storeAccountInfo(accountInfo).then(function() {
                                                                $scope.enabled2fa = accountInfo.requires2FA;

                                                                $timeout(function() {
                                                                    pleaseWaitDialog.dismiss();
                                                                }, 800);
                                                            });
                                                        });
                                                    });
                                                })
                                                ;
                                        })
                                        ;
                                });
                            });
                        }
                    )
                        ;
                })
                .catch(function(e) {
                    $scope.enabled2faToggle = false;
                    if (pleaseWaitDialog) {
                        pleaseWaitDialog.dismiss();
                    }

                    if (e === "dismiss" || e === "backdrop click" || e === "escape key press") {
                        // no1 cares
                        return;
                    } else {
                        dialogService.alert({
                            title: $translate.instant('SETTINGS_2FA').capitalize(),
                            body: e.message || e
                        });
                    }
                })
            ;
        };

        $scope.disable2FA = function() {
            var pleaseWaitDialog;

            return $q.when(null)
                .then(function() {
                    return dialogService.prompt({
                        title: $translate.instant('SETTINGS_2FA').capitalize(),
                        subtitle: $translate.instant('SETTINGS_2FA_DISABLE_2FA').capitalize(),
                        body: $translate.instant('SETTINGS_2FA_DISABLE_BODY').sentenceCase(),
                        label: $translate.instant('TWO_FACTOR_TOKEN').capitalize(),
                        ok: $translate.instant('SETTINGS_2FA_DISABLE_2FA').capitalize()
                    })
                        .result
                        .then(function(twoFactorToken) {
                            var pleaseWaitDialog = dialogService.alert({
                                title: $translate.instant('SETTINGS_2FA').capitalize(),
                                body: $translate.instant('PLEASE_WAIT').capitalize(),
                                body_class: 'text-center',
                                showSpinner: true,
                                ok: false
                            });


                            return sdkService.sdk().then(function(sdk) {
                                return sdk.disable2FA(twoFactorToken).then(function() {
                                    pleaseWaitDialog.update({
                                        title: $translate.instant('SETTINGS_2FA').capitalize(),
                                        body: $translate.instant('SETTINGS_2FA_DISABLE_DONE').capitalize(),
                                        body_class: 'text-center',
                                        ok: false
                                    });

                                    return launchService.getAccountInfo().then(function(accountInfo) {
                                        accountInfo.requires2FA = false;

                                        return launchService.storeAccountInfo(accountInfo).then(function() {
                                            $scope.enabled2fa = accountInfo.requires2FA;

                                            $timeout(function() {
                                                pleaseWaitDialog.dismiss();
                                            }, 800);
                                        });
                                    });
                                });
                            });
                        })
                    ;
                })
                .catch(function(e) {
                    $scope.enabled2faToggle = true;
                    if (pleaseWaitDialog) {
                        pleaseWaitDialog.dismiss();
                    }

                    if (e === "dismiss" || e === "backdrop click" || e === "escape key press") {
                        // no1 cares
                        return;
                    } else {
                        dialogService.alert({
                            title: $translate.instant('SETTINGS_2FA').capitalize(),
                            body: e.message || e
                        });
                    }
                })
            ;
        };

        $scope.$on('$destroy', function() {
            // force a reload after any saving is done
            $scope.$storingSettings.then(function() {
                settingsService.$load();
            });
        });
    })
    .controller('WalletSettingsCtrl', function($scope, settingsService) {
    })
    .controller('AboutSettingsCtrl', function($scope, settingsService) {
    })
    .controller('CropImageCtrl', function($scope, $modalInstance) {
        $scope.dismiss = function() {
            $modalInstance.dismiss();
        };

        $scope.ok = function() {
            $modalInstance.close($scope.profilePic);
        };
    })
;
