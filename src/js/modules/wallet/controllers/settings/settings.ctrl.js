(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("SettingsCtrl", SettingsCtrl);

    // TODO Review this part, decrease dependencies, create form settings service and move $http request to service
    function SettingsCtrl($scope, $http, $rootScope, $q, cryptoJS, sdkService, launchService, activeWallet,
                          $translate, $timeout, $log, $sce, dialogService, CONFIG, $modal, formSettingsService,
                          NotificationsService) {

        var savedSettings = {
            username: "",
            email: "",
            localCurrency: "USD",
            language: "en",
            receiveNewsletter: false,
            profilePic: null
        };

        var listenerFormSettings;
        var listenerEnabled2faToggle;
        var isEnabled2fa = false;

        $rootScope.pageTitle = 'SETTINGS';

        $scope.network = activeWallet.getReadOnlyWalletData().networkType;

        // this automatically updates an already open modal instead of popping a new one open
        // TODO remove it after moving modals change password, enable/disable 2FA
        $scope.alert = dialogService.alertSingleton();

        $scope.isLoading = true;
        $scope.isSubmitFormSettingsBtnDisabled = true;
        $scope.isEnabled2faToggle = false;

        $scope.formSettings = {
            username: "",
            email: "",
            localCurrency: "USD",
            language: "en",
            receiveNewsletter: false,
            profilePic: "/" + CONFIG.STATICSURL + "/img/blank_profile.png"
        };

        $scope.errors = {
            email: false,
            name: false
        };

        $scope.currencies = formSettingsService.getCurrencies();
        $scope.languages = formSettingsService.getLanguages();

        // Methods
        $scope.onChangeCurrency = onChangeCurrency;
        $scope.onChangeLanguage = onChangeLanguage;
        $scope.onFileDataUpdate = onFileDataUpdate;
        $scope.onResetError = onResetError;
        $scope.onChangePassword = onChangePassword;
        $scope.onSubmitFormSettings = onSubmitFormSettings;

        formSettingsService.fetchData()
            .then(initData);

        /**
         * Init data
         *
         * @param data
         */
        function initData(data) {
            $scope.currencies = data.currencies;
            $scope.languages = formSettingsService.getLanguages();

            $scope.formSettings = angular.copy(data.settings);

            $scope.isEnabled2faToggle = data.isEnabled2faToggle;
            isEnabled2fa = data.isEnabled2faToggle;

            savedSettings = angular.copy(data.settings);

            // Add watchers
            listenerFormSettings = $scope.$watch('formSettings', isSubmitFormSettingsBtnDisabled, true);
            listenerEnabled2faToggle = $scope.$watch('isEnabled2faToggle', open2faModal);

            $scope.isLoading = false;
        }

        /**
         * Change currency
         *
         * @param $event
         * @param currency
         */
        function onChangeCurrency($event, currency) {
            $event.preventDefault();

            if(currency !== $scope.formSettings.localCurrency) {
                $scope.formSettings.localCurrency = currency;
            }
        }

        /**
         * Change language
         *
         * @param $event
         * @param languageCode
         */
        function onChangeLanguage($event, languageCode) {
            $event.preventDefault();

            if(languageCode !== $scope.formSettings.language) {
                $scope.formSettings.language = languageCode;
            }
        }

        /**
         * File data update
         * callback after we load an image source
         *
         * @param name
         * @param data
         */
        function onFileDataUpdate(name, data) {
            if(name === "profileIcon") {
                openCropImageModal(data);
            }
        }

        /**
         * Reset error
         */
        function onResetError(key) {
            if ($scope.errors[key]) {
                $scope.errors[key] = false;
            }
        }

        /**
         * Submit form
         */
        function onSubmitFormSettings() {
            // TODO Create validation service, add custom validation directives (provide array of rule's names and model)
            var emailRule = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
            var stringOrEmptyRule = /(^[a-zA-Z\d]+$)|(^$)/;

            resetErrors();

            if(!emailRule.test($scope.formSettings.email)) {
                $scope.errors.email = true;
                emailErrorModal();
            }

            if($scope.formSettings.username.length && ($scope.formSettings.username.length < 4 || !stringOrEmptyRule.test($scope.formSettings.username))) {
                $scope.errors.name = true;
                usernameErrorModal();
            }

            if(!$scope.errors.email && !$scope.errors.name) {
                var saveObj = {};

                $scope.isLoading = true;

                // Send only changed data
                angular.forEach($scope.formSettings, function (val, key) {
                    if(savedSettings[key] !== val) {
                        saveObj[key] = val;
                    }
                });

                // Convert receive news letter boolean flag to integers
                if(angular.isDefined(saveObj.receiveNewsletter)) {
                    saveObj.receiveNewsletter = saveObj.receiveNewsletter ? 1 : 0;
                }

                formSettingsService.saveData(saveObj)
                    .then(saveDataSuccessHandler, saveDataErrorHandler);
            }
        }

        /**
         * Handler on save success
         */
        function saveDataSuccessHandler() {
            $scope.isLoading = false;
            $scope.isSubmitFormSettingsBtnDisabled = true;

            // Update language if it was changed
            if ($scope.formSettings.language !== savedSettings.language) {
                $rootScope.changeLanguage($scope.formSettings.language);
            }

            savedSettings = angular.copy($scope.formSettings);
        }

        /**
         * Handler on save error
         */
        function saveDataErrorHandler(e) {
            $scope.isLoading = false;

            dialogService.alert({
                title: $translate.instant('SETTINGS'),
                body: e.message || e
            });
        }

        /**
         * Is submit form settings button disabled
         */
        function isSubmitFormSettingsBtnDisabled() {
            $scope.isSubmitFormSettingsBtnDisabled = angular.equals(savedSettings, $scope.formSettings);
        }

        /**
         * Reset errors
         */
        function resetErrors() {
            $scope.errors.email = false;
            $scope.errors.name = false;
        }

        /**
         * Open modal window and crop the image
         *
         * @param data
         */
        function openCropImageModal(data) {
            var modalInstance = $modal.open({
                controller: "ModalCropImageCtrl",
                templateUrl: "js/modules/wallet/controllers/modal-crop-image/modal-crop-image.tpl.html",
                windowClass: 'modal-max-height',
                size: 'lg',
                backdrop: 'static',
                resolve: {
                    imgData: function () {
                        return data;
                    }
                }
            });

            modalInstance.result.then(updateProfilePic);
        }

        /**
         * Update profile pic, handler for crop image modal window
         *
         * @param data
         */
        function updateProfilePic(data) {
            $scope.formSettings.profilePic = data;
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
        function usernameErrorModal() {
            return dialogService.alert(
                $translate.instant('ERROR_TITLE_2'),
                $translate.instant('MSG_INVALID_USERNAME')
            ).result;
        }

        // TODO move to modal controller
        function emailErrorModal() {
            return dialogService.alert(
                $translate.instant('ERROR_TITLE_2'),
                $translate.instant('MSG_BAD_EMAIL')
            ).result;
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

                                                            return formSettingsService.updateLaunchService2FA($scope.isEnabled2faToggle)
                                                                .then(function () {
                                                                    isEnabled2fa = $scope.isEnabled2faToggle;

                                                                    $timeout(function() {
                                                                        pleaseWaitDialog.dismiss();
                                                                    }, 1000);
                                                                });

                                                        }, function (e) {
                                                            // Error handler for wrong two factor token
                                                            $scope.isEnabled2faToggle = isEnabled2fa;

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
                                            $scope.isEnabled2faToggle = isEnabled2fa;
                                        });
                                }, function (e) {
                                    // Error handler for wrong password
                                    $scope.isEnabled2faToggle = isEnabled2fa;

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
                            $scope.isEnabled2faToggle = isEnabled2fa;
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

                                    return formSettingsService.updateLaunchService2FA($scope.isEnabled2faToggle)
                                        .then(function () {
                                            isEnabled2fa = $scope.isEnabled2faToggle;

                                            $timeout(function() {
                                                pleaseWaitDialog.dismiss();
                                            }, 1500);
                                        });
                                }, function (e) {
                                    // Error handler for wrong two factor token
                                    $scope.isEnabled2faToggle = isEnabled2fa;

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
                            $scope.isEnabled2faToggle = isEnabled2fa;
                        });
                });
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
                                                        )
                                                        ;
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

        $scope.sweepCoins = function () {
            $modal.open({
                controller: "SweepCoinsModalController",
                templateUrl: "js/modules/wallet/controllers/sweep-coins-modal/sweep-coins-modal.tpl.html",
                size: 'md'
            });
        };

        $scope.addProtocolHandler = function() {
            // Prompt user about this feature
            return NotificationsService.promptBitcoinURIHandler().result.then(function() {
                try {
                    $log.debug('Trying to register bitcoin URI scheme');
                    navigator.registerProtocolHandler(
                        'bitcoin',
                        CONFIG.WALLET_URL + '/#/wallet/handleURI/%s',
                        'BTC.com Bitcoin Wallet'
                    );
                } catch (e) {
                    $log.error('Couldn\'t register bitcoin: URL scheme', e, e.message);

                    if (e.name === "SecurityError") {
                        return dialogService.alert(
                            $translate.instant('ERROR_TITLE_2'),
                            $translate.instant('BROWSER_SECURITY_ERROR'),
                            $translate.instant('OK')
                        ).result;
                    }
                }
            });
        };

        $scope.$on('$destroy', function() {
            // Remove existing listeners
            if(listenerFormSettings) {
                listenerFormSettings();
            }

            if(listenerEnabled2faToggle) {
                listenerEnabled2faToggle()
            }
        });
    }

})();
