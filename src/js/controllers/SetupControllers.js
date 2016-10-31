angular.module('blocktrail.wallet')
    .controller('SetupCtrl', function($scope, $modal, $state, CONFIG) {
        $scope.showMobileDialog = bowser.mobile;
        $scope.showMobileDialogOnce = function() {
            if ($scope.showMobileDialog) {
                $scope.showMobileDialog =  false;
                $modal.open({
                    controller: 'SetupDownloadMobileModalController',
                    templateUrl: 'templates/setup/setup.download-mobile.modal.html'
                });
            }
        };


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
        // display mobile app download popup
        $scope.showMobileDialogOnce();

        $scope.working = false;
        $scope.form = {
            username: "",
            password: "",
            forceNewWallet: false
        };

        $scope.error = null;
        $scope.errorDetailed = null;
        $scope.$watch('form', function() {
            $scope.error = null;
            $scope.errorDetailed = null;
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
            $scope.errorDetailed = null;

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
                                $log.debug('forceNewWallet', $scope.form.forceNewWallet);

                                if (!$scope.form.forceNewWallet) {
                                    $scope.setupInfo.identifier = result.data.existing_wallet || $scope.setupInfo.identifier;
                                }
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
                        console.log(error);
                        $scope.error = 'MSG_BAD_LOGIN_UNKNOWN';
                        $scope.errorDetailed = "" + (error.message || error.msg || error);
                        if ($scope.errorDetailed === ("" + {})) {
                            $scope.errorDetailed = null;
                        }
                    } else {
                        $scope.error = 'MSG_BAD_NETWORK';
                    }

                    throw error;
                }
            );
        };
    })
    .controller('SetupNewAccountCtrl', function($scope, $rootScope, $state, $q, $http, $timeout, $modal, launchService, CONFIG,
                                                settingsService, dialogService, $translate, $log, PasswordStrength, $filter) {
        // display mobile app download popup
        $scope.showMobileDialogOnce();

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
        $scope.$on('$destroy', function() {
            $scope.alert.dismiss();
        });

        $scope.toLogin = function() {
            $state.go('app.setup.login');
        };

        $scope.checkPassword = function() {
            if (!$scope.form.password) {
                $scope.passwordCheck = null;
                return $q.when(false);
            }

            return PasswordStrength.check($scope.form.password, [$scope.form.username, $scope.form.email, "BTC.com", "wallet"])
                .then(function(result) {
                    result.duration = $filter('duration')(result.crack_times_seconds.online_no_throttling_10_per_second * 1000);
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
            if (!$scope.termsofservice) {
                $scope.errMsg = 'MSG_BAD_LEGAL';
                return false;
            }

            //confirm their password
            return $scope.checkPassword()
                .then(function(passwordCheck) {
                    if (!passwordCheck || passwordCheck.score < CONFIG.REQUIRED_PASSWORD_STRENGTH) {
                        $scope.errMsg = 'MSG_WEAK_PASSWORD';
                        return false;
                    }

                    return dialogService.prompt({
                        title: $translate.instant('MSG_REPEAT_PASSWORD').capitalize(),
                        body: $translate.instant('SETUP_PASSWORD_REPEAT_PLACEHOLDER'),
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
                });

        };

        $scope.register = function() {
            var postData = {
                username: $scope.form.username,
                email: $scope.form.email,
                password: CryptoJS.SHA512($scope.form.password).toString(),
                password_score: $scope.form.passwordCheck && $scope.form.passwordCheck.score || 0,
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
                                                $injector, settingsService, dialogService, $analytics, trackingService, CONFIG) {

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

            $scope.updateProgress({title: 'LOADING_WALLET'});
            $scope.working = true;

            $scope.createWallet();
        };

        $scope.progressWidth = 5;
        var defaultProgress = {
            title: null,
            body: null,
            header_class: 'text-neutral',
            ok: false
        };
        $scope.updateProgress = function (progress) {
            progress = angular.extend({}, defaultProgress, progress);
            $log.debug('updateProgress: ' + progress.title + " - " + progress.body);

            $timeout(function() {
                $scope.progressWidth += 15;
                if ($scope.progressWidth >= 90) {
                    $scope.progressWidth = 100;
                }
                $scope.progressStatus = progress;
            });
        };

        $scope.createWallet = function() {
            return sdkService.sdk()
                .then(function(sdk) {
                    $scope.sdk = sdk;
                    $log.debug('initialising wallet: ' + $scope.setupInfo.identifier, $scope.sdk);
                    return $scope.sdk.initWallet({identifier: $scope.setupInfo.identifier, password: $scope.setupInfo.password});
                })
                .then(function(wallet) {
                    $analytics.eventTrack('initWallet', {category: 'Events'});

                    // time to upgrade to V3 ppl!
                    if (wallet.walletVersion != blocktrailSDK.Wallet.WALLET_VERSION_V3) {
                        $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'UPGRADING_WALLET_BODY'});

                        return wallet.upgradeToV3($scope.setupInfo.password)
                            .progress(function(progress) {
                                /*
                                 * per step we increment the progress bar and display some new progress text
                                 * some of the text doesn't really match what is being done,
                                 * but we just want the user to feel like something is happening.
                                 */
                                switch (progress) {
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_START:
                                        $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'UPGRADING_WALLET_BODY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_SECRET:
                                        $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'CREATING_GENERATE_PRIMARYKEY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_PRIMARY:
                                        $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'CREATING_GENERATE_BACKUPKEY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_RECOVERY:
                                        $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'CREATING_GENERATE_RECOVERY'});
                                        break;
                                }

                            })
                            .then(function() {
                                $scope.updateProgress({title: 'UPGRADING_WALLET', body: 'UPGRADING_WALLET_BODY'});

                                // bump progress
                                $scope.progressWidth = 90;

                                return wallet;
                            });

                    } else {
                        $log.debug('wallet initialised', wallet);
                        // bump progress
                        $scope.progressWidth = 90;
                        return wallet;
                    }
                }, function(error) {
                    if (error.message.match(/not found/) || error.message.match(/couldn't be found/)) {
                        //no existing wallet - create one
                        $log.debug('creating new wallet');
                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'PLEASE_WAIT'});
                        var t = (new Date).getTime();
                        $analytics.eventTrack('createNewWallet', {category: 'Events'});

                        return $scope.sdk.createNewWallet({
                            walletVersion: CONFIG.DEFAULT_WALLET_VERSION,
                            identifier: $scope.setupInfo.identifier,
                            password: $scope.setupInfo.password})
                            .progress(function(progress) {
                                /*
                                 * per step we increment the progress bar and display some new progress text
                                 * some of the text doesn't really match what is being done,
                                 * but we just want the user to feel like something is happening.
                                 */
                                switch (progress) {
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_START:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'PLEASE_WAIT'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_SECRET:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_GENERATE_PRIMARYKEY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_PRIMARY:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_GENERATE_BACKUPKEY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_RECOVERY:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_GENERATE_RECOVERY'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_PRIMARY:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_INIT_KEYS'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_BACKUP:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_INIT_KEYS'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_SUBMIT:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_SUBMIT_WALLET'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_INIT:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_INIT_WALLET'});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_DONE:
                                        $scope.updateProgress({title: 'CREATING_WALLET', body: 'CREATING_DONE'});
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
                .then(function(wallet) {
                    // while logging in we stash the secret so we can decrypt the glidera accesstoken
                    launchService.stashWalletSecret(wallet.secret);
                    wallet.lock();
                })
                .then(function() {
                    //set the wallet as the main wallet
                    $log.debug('setting wallet as main wallet');
                    $scope.updateProgress({title: 'PREPARING_WALLET'});
                    return $scope.sdk.setMainMobileWallet($scope.setupInfo.identifier);
                })
                .then(function() {
                    //store the identity and encrypted password
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
                            walletVersion: $scope.setupInfo.backupInfo.walletVersion,
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
                        trackingService.trackRegistration();

                        //if a new wallet has been created, go to the wallet backup page
                        $state.go('app.setup.backup');
                    } else {
                        trackingService.trackLogin();

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

                    if (e == 'CANCELLED' || e == "dismiss") {
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
            walletVersion: backupInfo.walletVersion,
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

    .controller('SetupDownloadMobileModalController', function($scope, $modalInstance) {
        $scope.mobileOs = bowser.android ? 'android' : bowser.ios ? 'ios' : 'both';

        $scope.dismiss = function() {
            $modalInstance.close();
        };
    })

    .controller('SetupLoggedoutCtrl', function($scope, CONFIG) {
        $scope.CONFIG = CONFIG;
    })
;
