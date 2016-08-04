angular.module('blocktrail.wallet')
    .controller('SetupCtrl', function($scope, $state, CONFIG) {
        $scope.setupInfo = {
            // force uniqueness of the identifier to make it easier to force a
            identifier: CONFIG.DEFAULT_IDENTIFIER + "-" + randomBytes(8).toString('hex'),
            password: "",
            primaryMnemonic: "",
            backupMnemonic: "",
            blocktrailPublicKeys: null
        };
    })
    .controller('SetupStartCtrl', function($scope, $state) {
        $scope.newAccount = function() {
            $state.go('app.setup.register');
        };
        $scope.toLogin = function() {
            $state.go('app.setup.login');
        };
    })
    .controller('SetupLoginCtrl', function($scope, $rootScope, $state, $q, $http, $timeout, launchService, CONFIG, settingsService,
                                           dialogService, FormHelper, $sce, $translate, $log) {
        $scope.working = false;

        $scope.error = null;
        $scope.$watch('form', function() {
            $scope.error = null;
        }, true);

        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();
        $scope.$on('$destroy', function() {
            $scope.alert.dismiss();
        });

        $scope.doLogin = function(loginForm) {
            if ($scope.working) {
                return false;
            }

            $scope.error = null;

            FormHelper.setAllDirty(loginForm);

            if (loginForm.$invalid) {
                return false;
            }

            $scope.working = true;
            $scope.login();
        };

        $scope.twoFactorToken = null;

        $scope.login = function() {
            var twoFactorToken = $scope.twoFactorToken;
            $scope.twoFactorToken = null; // consumed

            $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "t" : "") + "BTC/mywallet/enable", {
                login: $scope.form.username,
                password: CryptoJS.SHA512($scope.form.password).toString(),
                platform: "Web",
                version: $rootScope.appVersion,
                two_factor_token: twoFactorToken,
                device_name: navigator.userAgent || 'Unknown Browser'
            }).then(
                function(result) {
                    $q.when(result.data.encrypted_secret)
                        .then(function(encryptedSecret) {
                            if (!encryptedSecret) {
                                return null;
                            } else {
                                var secret;
                                try {
                                    secret = CryptoJS.AES.decrypt(encryptedSecret, $scope.form.password).toString(CryptoJS.enc.Utf8);
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
                                $log.debug('existing_wallet', result.data.existing_wallet);

                                $scope.setupInfo.identifier = result.data.existing_wallet || $scope.setupInfo.identifier;
                                $scope.setupInfo.password = $scope.form.password;

                                //save the default settings and do a profile sync
                                settingsService.username = $scope.form.username || result.data.username;
                                settingsService.displayName = settingsService.username;
                                settingsService.email = $scope.form.email || result.data.email;
                                settingsService.$store().then(function() {
                                    return settingsService.$syncProfileDown()
                                        .then(function() {
                                            return settingsService.$syncSettingsDown();
                                        })
                                        .then(function() {
                                            $state.go('app.setup.wallet');
                                        }, function() {
                                            $state.go('app.setup.wallet');
                                        });
                                });
                            });
                        })
                    ;
                },
                function(error) {
                    $scope.working = false;

                    if (error.data) {
                        error = blocktrailSDK.Request.handleFailure(error.data);

                        if (error.requires_sha512) {
                            return dialogService.alert({
                                title: $translate.instant('SETUP_LOGIN_FAILED').sentenceCase(),
                                bodyHtml: $sce.trustAsHtml($translate.instant('MSG_UPGRADE_REQUIRED').sentenceCase())
                            });

                        } else if (error instanceof blocktrailSDK.WalletMissing2FAError) {
                            return dialogService.prompt(
                                $translate.instant('SETUP_LOGIN').sentenceCase(),
                                $translate.instant('MSG_MISSING_TWO_FACTOR_TOKEN').capitalize()
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
                                $translate.instant('SETUP_LOGIN').sentenceCase(),
                                $translate.instant('MSG_INCORRECT_TWO_FACTOR_TOKEN').capitalize()
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
                            $scope.error = 'MSG_BAD_LOGIN';
                        }

                    } else if(error) {
                        $scope.error = 'MSG_BAD_LOGIN';
                    } else {
                        $scope.error = 'MSG_BAD_NETWORK';
                    }

                    throw error;
                }
            );
        };
    })
    .controller('SetupNewAccountCtrl', function($scope, $rootScope, $state, $q, $http, $timeout, launchService, CONFIG,
                                                settingsService, dialogService, $translate, $log) {
        $scope.usernameTaken = null;
        $scope.working       = false;
        $scope.errMsg        = false;
        $scope.form = {
            username: null,
            email: null,
            password: null,
            registerWithEmail: 1 //can't use bool, must be number equivalent
        };

        // this automatically updates an already open modal instead of popping a new one open

        $scope.alert = dialogService.alertSingleton();
        $scope.$on('$destroy', function() {
            $scope.alert.dismiss();
        });

        $scope.toLogin = function() {
            $state.go('app.setup.login');
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
                $scope.errMsg = 'MSG_BAD_USERNAME';
                return false;
            }
            if ($scope.form.registerWithEmail && !$scope.form.email) {
                $scope.errMsg = 'MSG_BAD_EMAIL';
                return false;
            }
            if (!$scope.form.password) {
                $scope.errMsg = 'MSG_BAD_PASSWORD';
                return false;
            }

            //if the user is registering with username, confirm their password
            if (!$scope.form.registerWithEmail) {
                return dialogService.prompt({
                        title: $translate.instant('MSG_REPEAT_PASSWORD').capitalize(),
                        body: $translate.instant('SETUP_PASSWORD_REPEAT_PLACEHOLDER').capitalize(),
                        input_type: 'password',
                        icon: 'key'
                    }).result
                    .then(
                        function(dialogResult) {
                            if ($scope.form.password === dialogResult.trim()) {
                                $scope.working = true;

                                $scope.register();
                            } else {
                                $scope.errMsg = 'MSG_BAD_PASSWORD_REPEAT';
                            }
                        }
                    );
            } else {
                $scope.working = true;
                $scope.register();
            }
        };

        $scope.register = function() {
            var postData = {
                username: $scope.form.username,
                email: $scope.form.email,
                password: CryptoJS.SHA512($scope.form.password).toString(),
                platform: "Web",
                version: $rootScope.appVersion,
                device_name: navigator.userAgent || 'Unknown Browser'
            };
            
            $http.post(CONFIG.API_URL + "/v1/BTC/mywallet/register", postData)
                .then(function(result) {
                    return launchService.storeAccountInfo(result.data).then(function() {
                        $scope.setupInfo.password = $scope.form.password;

                        $scope.working = false;

                        //save the default user settings
                        settingsService.username = $scope.form.username;
                        settingsService.displayName = $scope.form.username; //@TODO maybe try and determine a display name from their email
                        settingsService.email = $scope.form.email;
                        
                        settingsService.$store().then(function() {
                            $timeout(function() {
                                $state.go('app.setup.wallet');
                            }, 300);
                        });
                    });
                },
                function(error) {
                    $log.error(error);
                    $scope.working = false;

                    if (error.data.msg.toLowerCase().match(/username exists/)) {
                        $scope.errMsg = 'MSG_USERNAME_TAKEN';
                    } else if (error.data.msg.toLowerCase().match(/already in use/)) {
                        $scope.errMsg = 'MSG_EMAIL_TAKEN';
                    } else {
                        $scope.errMsg = error.data.msg;
                    }
                });
        };
    })
    .controller('SetupWalletInitCtrl', function($q, $scope, $state, launchService, sdkService, $log, $translate, $timeout,
                                                $injector, settingsService, dialogService, $ionicAnalytics) {

        $scope.progressStatus = {};
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();
        $scope.$on('$destroy', function() {
            $scope.alert.dismiss();
        });

        // if we don't have the password anymore (user hit F5 or smt)
        //  then we require a login again
        if (!$scope.setupInfo.password) {
            return launchService.clearAccountInfo().then(function() {
                return $state.go('app.setup.login');
            });
        }

        $scope.setupWallet = function() {
            if ($scope.working) {
                return false;
            }

            $scope.progressStatus = {title: 'CREATING_WALLET', header_class: 'text-neutral', body: null, ok: false};
            $scope.working = true;

            $scope.createWallet();
        };

        $scope.progressDone   = false;
        $scope.progressStep   = 1;
        $scope.progressWidth  = 5;
        $scope.progressDelay  = 1000;


        $scope.updateProgress = function (progress) {
            $scope.progressDelay = $scope.progressDelay*1.4;

            $timeout(function() {
                $scope.progressStep ++;
                $scope.progressWidth  += 15;
                if ($scope.progressWidth>=90) {
                    $scope.progressWidth =100;
                }
                $scope.progressStatus = progress;

                if ($scope.progressDone && $scope.progressStep>=7) {
                    $timeout(function() {
                        $scope.progressWidth =100;
                        $state.go('app.setup.backup');
                    }, 2000);
                }

            }, $scope.progressDelay);
        };

        $scope.createWallet = function() {
            return sdkService.sdk()
                .then(function(sdk) {
                    $scope.sdk = sdk;
                    $log.debug('initialising wallet: ' + $scope.setupInfo.identifier, $scope.sdk);
                    return $scope.sdk.initWallet({identifier: $scope.setupInfo.identifier, password: $scope.setupInfo.password});
                })
                .then(function(wallet) {
                    $ionicAnalytics.track('initWallet', {});

                    $log.debug('wallet initialised', wallet);
                    $scope.progressWidth = 90;
                    //wallet already exists with these detail
                    return $q.when(wallet);
                }, function(error) {
                    if (error.message.match(/not found/) || error.message.match(/couldn't be found/)) {
                        //no existing wallet - create one
                        $log.debug('creating new wallet');
                        $scope.progressStatus = {title: 'CREATING_WALLET', header_class: 'text-neutral', body: 'PLEASE_WAIT', ok: false};
                        var t = (new Date).getTime();
                        $ionicAnalytics.track('createNewWallet', {});
                        return $scope.sdk.createNewWallet({identifier: $scope.setupInfo.identifier, password: $scope.setupInfo.password})
                            .progress(function(progress) {

                                switch (progress) {
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_START:
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('PLEASE_WAIT').capitalize(), ok: false});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_PRIMARY:
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('CREATING_GENERATE_PRIMARYKEY').capitalize(), ok: false});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_BACKUP:
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('CREATING_GENERATE_BACKUPKEY').capitalize(), ok: false});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_SUBMIT:
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('CREATING_SUBMIT_WALLET').capitalize(), ok: false});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_INIT:
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('CREATING_INIT_WALLET').capitalize(), ok: false});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_DONE:
                                        $scope.progressDone = true;
                                        $scope.updateProgress({title: 'CREATING_WALLET', header_class: 'text-neutral', body: $translate.instant('CREATING_DONE').capitalize(), ok: false});
                                        break;
                                }

                            })
                            .spread(function(wallet, backupInfo, more) {
                                $log.debug('new wallet created in [' + ((new Date).getTime() - t) + 'ms]');
                                $scope.setupInfo.backupInfo = backupInfo;

                                return $q.when(wallet);
                            })
                        ;
                    } else if (error.message.match(/password/) || error instanceof blocktrailSDK.WalletDecryptError) {
                        // wallet exists but with different password
                        $log.debug("wallet with identifier [" + $scope.setupInfo.identifier + "] already exists, prompting for old password");

                        return $scope.alert({
                            title: $translate.instant('SETUP_EXISTING_WALLET').capitalize(),
                            body: $translate.instant('MSG_WALLET_PASSWORD_MISMATCH').sentenceCase()
                        }).result
                            .then(function() {
                                return $scope.promptWalletPassword();
                            }
                        );
                    } else {
                        return $q.reject(error);
                    }
                })
                .then(function() {
                    //set the wallet as the main wallet
                    $log.debug('setting wallet as main wallet');
                    $scope.progressStatus = {title: 'SAVING_WALLET', header_class: 'text-neutral', body: null, ok: false};
                    return $scope.sdk.setMainMobileWallet($scope.setupInfo.identifier);
                })
                .then(function() {
                    //store the identity and encrypted password
                    $scope.progressStatus = {title: 'SAVING_WALLET', header_class: 'text-neutral', body: null, ok: false};
                    $log.debug('saving wallet info', $scope.setupInfo.identifier, null);
                    return launchService.storeWalletInfo($scope.setupInfo.identifier, null);
                })
                .then(function() {
                    if ($scope.setupInfo.backupInfo) {
                        //store the backup info temporarily
                        $log.debug('saving backup info');
                        var pubKeys = [];
                        angular.forEach($scope.setupInfo.backupInfo.blocktrailPublicKeys, function(pubKey, keyIndex) {
                            pubKeys.push({
                                keyIndex: keyIndex,
                                pubKey: pubKey.toBase58()
                            });
                        });

                        return launchService.storeBackupInfo({
                            identifier: $scope.setupInfo.identifier,
                            encryptedPrimarySeed: $scope.setupInfo.backupInfo.encryptedPrimarySeed,
                            encryptedSecret: $scope.setupInfo.backupInfo.encryptedSecret,
                            backupSeed: $scope.setupInfo.backupInfo.backupSeed,
                            recoveryEncryptedSecret: $scope.setupInfo.backupInfo.recoveryEncryptedSecret,
                            blocktrailPublicKeys: pubKeys
                        });
                    } else {
                        return;
                    }
                })
                .then(function() {
                    $log.debug('All done. Onwards to victory!');
                    if ($scope.setupInfo.backupInfo) {
                        //if a new wallet has been created, go to the wallet backup page
                        $state.go('app.setup.backup');
                    } else {
                        //else continue to wallet
                        settingsService.$load().then(function() {
                            //load the settings so we can update them
                            settingsService.setupComplete = true;
                            settingsService.$store().then(function() {
                                $state.go('app.wallet.summary');
                            });
                        });
                    }
                })
                .catch(function(e) {
                    $log.error(e);
                    $scope.working = false;

                    if (e == 'CANCELLED') {
                        //user canceled action
                        return false;
                    } else {
                        $scope.progressStatus = {title: 'FAIL', header_class: 'text-bad', body: e.toString()};
                    }
                });
        };

        /**
         * prompt for a correct wallet password - repeats on bad password
         */
        $scope.promptWalletPassword = function() {
            //prompt for a correct wallet password and retry the wallet creation process
            return dialogService.prompt({
                title: $translate.instant('SETUP_WALLET_PASSWORD').capitalize(),
                body: $translate.instant('MSG_WALLET_PASSWORD').sentenceCase(),
                input_type: 'password',
                icon: 'key'
            }).result
                .then(
                    function(dialogResult) {
                        $scope.setupInfo.password = dialogResult.trim();

                        //try the new password
                        $log.debug('re-initialising wallet with new password: ' + $scope.setupInfo.identifier);
                        return $scope.sdk.initWallet({identifier: $scope.setupInfo.identifier, password: $scope.setupInfo.password})
                            .then(function(wallet) {
                                //success, password is correct. We can continue
                                return $q.when(wallet);
                            }, function(error) {
                                if (error.message.match(/password/) || error instanceof blocktrailSDK.WalletDecryptError) {
                                    //password still incorrect, try again
                                    return $scope.alert($translate.instant('MSG_BAD_PWD').capitalize(), $translate.instant('MSG_TRY_AGAIN').sentenceCase())
                                        .result
                                        .then(function() {
                                            return $scope.promptWalletPassword();
                                        })
                                    ;
                                } else {
                                    //some other error encountered
                                    return $q.reject(error);
                                }
                            });
                    },
                function() {
                    return $q.reject('CANCELLED');
                }
            );
        };

        $scope.setupWallet();
    })
    .controller('SetupWalletBackupCtrl', function(backupInfo, $scope, $state, $q, $translate, $timeout, $window,
                                                  settingsService, $log, sdkService, dialogService, launchService, $injector) {
        $scope.displayTextBackup = true;
        $scope.backupSaved = false;
        $scope.qrSettings = {
            correctionLevel: 7,
            SIZE: 150,
            inputMode: 'M',
            image: true
        };

        $scope.setupInfo.identifier = backupInfo.identifier;
        $scope.setupInfo.backupInfo = {
            encryptedPrimarySeed: backupInfo.encryptedPrimarySeed,
            encryptedSecret: backupInfo.encryptedSecret,
            backupSeed: backupInfo.backupSeed,
            recoveryEncryptedSecret: backupInfo.recoveryEncryptedSecret
        };

        // hacky, we asume that user won't click generate backup before this promise is finished
        if (!$scope.setupInfo.backupInfo.blocktrailPublicKeys) {
            sdkService.sdk().then(function(sdk) {
                $scope.setupInfo.backupInfo.blocktrailPublicKeys = {};
                angular.forEach(backupInfo.blocktrailPublicKeys, function(pubkey, key) {
                    $scope.setupInfo.backupInfo.blocktrailPublicKeys[pubkey.keyIndex] = bitcoinjs.HDNode.fromBase58(pubkey.pubKey, sdk.network);
                });
            });
        }

        $scope.backupPageError  = false;

        $scope.export = function() {
            var extraInfo = [];

            if (settingsService.username) {
                extraInfo.push({title: 'Username', value: settingsService.username});
            }
            if (settingsService.email) {
                extraInfo.push({title: 'Email', value: settingsService.email});
            }

            var backup = new sdkService.BackupGenerator(
                $scope.setupInfo.identifier,
                $scope.setupInfo.backupInfo,
                extraInfo
            );

            try {
                backup.generatePDF(function (err, pdf) {
                    if (err) {
                        $log.error(err);
                        dialogService.alert(err, $translate.instant('ERROR'), $translate.instant('OK'));
                    } else {
                        $scope.backupPDF = pdf;
                        $scope.backupPDF.save("BTC.com Wallet Recovery Backup Sheet - " + $scope.setupInfo.identifier + ".pdf");
                    }
                });
            } catch(error) {
                $log.error("Backup generation error", error);
            }
        };

        $scope.continue = function() {
            if (!$scope.backupSaved) {
                $scope.backupPageError = $translate.instant('SETUP_WALLET_BACKUP_CHECKBOX');
            } else {
                //delete all temp backup info
                launchService.clearBackupInfo()
                    .then(function() {
                        settingsService.$load().then(function() {
                            //load the settings so we can update them
                            settingsService.setupComplete = true;
                            settingsService.$store().then(function() {
                                var Wallet = $injector.get('Wallet');

                                Wallet.pollTransactions().then(function() {
                                    $state.go('app.wallet.summary');
                                });
                            });
                        });
                    })
                ;
            }
        };
    })
    .controller('SetupForgotPassCtrl', function($scope, $rootScope, $state, $http, FormHelper, CONFIG) {
        $scope.working  = false;
        $scope.error    = null;
        $scope.form     = {
            email : null
        };

        $scope.doForgotPass = function(forgotPassForm) {
            if ($scope.working) {
                return false;
            }
            $scope.error = null;
            FormHelper.setAllDirty(forgotPassForm);
            if (forgotPassForm.$invalid) {
                return false;
            }
            $scope.working = true;

            $http.post(CONFIG.API_URL + "/json/user/profile/forgotpass", {
                email: $scope.form.email
            }).then(
                function(result) {
                    $scope.working = false;
                    //$state.go('app.setup.forgotpass');

                },
                function(error) {
                    $scope.working = false;
                }
            );


        };

    })
;
