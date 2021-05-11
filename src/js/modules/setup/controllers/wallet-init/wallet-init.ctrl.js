(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupWalletInitCtrl", SetupWalletInitCtrl);

    function SetupWalletInitCtrl($q, $scope, $state, launchService, sdkService, $log, $translate, $timeout,
                                 CONFIG, dialogService, $analytics, trackingService) {

        $scope.progressStatus = {};
        // this automatically updates an already open modal instead of popping a new one open
        $scope.alert = dialogService.alertSingleton();

        $scope.$on("$destroy", function() {
            $scope.alert.dismiss();
        });

        // if we don't have the password anymore (user hit F5 or smt)
        //  then we require a login again
        if (!$scope.setupInfo.password) {
            return launchService.clearAccountInfo().then(function() {
                return $state.go("app.setup.login");
            });
        }

        $scope.setupWallet = function() {
            if ($scope.working) {
                return false;
            }

            $scope.updateProgress({title: "LOADING_WALLET"});
            $scope.working = true;

            $scope.createWallet();
        };

        $scope.progressWidth = 5;

        var defaultProgress = {
            title: null,
            body: null,
            header_class: "text-neutral",
            ok: false
        };

        $scope.updateProgress = function (progress) {
            progress = angular.extend({}, defaultProgress, progress);
            $log.debug("updateProgress: " + progress.title + " - " + progress.body);

            $timeout(function() {
                $scope.progressWidth += 15;
                if ($scope.progressWidth >= 90) {
                    $scope.progressWidth = 100;
                }
                $scope.progressStatus = progress;
            });
        };

        $scope.createWallet = function() {
            return $q.when(launchService.getAccountInfo())
                .then(function(accountInfo) {
                    sdkService.setAccountInfo(accountInfo);
                    return sdkService.getSdkByActiveNetwork();
                })
                .then(function(sdk) {
                    $scope.sdk = sdk;
                    $scope.sdkReadOnlyObject = sdkService.getReadOnlySdkData();
                    var useCashAddress = CONFIG.NETWORKS[sdkService.getNetworkType()].CASHADDRESS;
                    $log.debug("initialising wallet: " + $scope.setupInfo.identifier, $scope.sdk);

                    return $scope.sdk.initWallet({
                        identifier: $scope.setupInfo.identifier,
                        password: $scope.setupInfo.password,
                        useCashAddress: useCashAddress
                    });
                })
                .then(function(wallet) {
                    $analytics.eventTrack("initWallet", {category: "Events"});

                    // time to upgrade to V3 ppl!
                    if (wallet.walletVersion !== blocktrailSDK.Wallet.WALLET_VERSION_V3) {
                        $scope.updateProgress({title: "UPGRADING_WALLET", body: "UPGRADING_WALLET_BODY"});

                        return wallet.upgradeToV3($scope.setupInfo.password)
                            .progress(function(progress) {
                                /*
                                 * per step we increment the progress bar and display some new progress text
                                 * some of the text doesn't really match what is being done,
                                 * but we just want the user to feel like something is happening.
                                 */
                                switch (progress) {
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_START:
                                        $scope.updateProgress({title: "UPGRADING_WALLET", body: "UPGRADING_WALLET_BODY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_SECRET:
                                        $scope.updateProgress({title: "UPGRADING_WALLET", body: "CREATING_GENERATE_PRIMARYKEY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_PRIMARY:
                                        $scope.updateProgress({title: "UPGRADING_WALLET", body: "CREATING_GENERATE_BACKUPKEY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_RECOVERY:
                                        $scope.updateProgress({title: "UPGRADING_WALLET", body: "CREATING_GENERATE_RECOVERY"});
                                        break;
                                }

                            })
                            .then(function() {
                                $scope.updateProgress({title: "UPGRADING_WALLET", body: "UPGRADING_WALLET_BODY"});

                                // bump progress
                                $scope.progressWidth = 90;

                                return wallet;
                            });

                    } else {
                        $log.debug("wallet initialised", wallet);
                        // bump progress
                        $scope.progressWidth = 90;
                        return wallet;
                    }
                }, function(error) {
                    if (error.message.match(/not found/) || error.message.match(/couldn't be found/)) {
                        //no existing wallet - create one
                        $log.debug("creating new wallet");
                        $scope.updateProgress({title: "CREATING_WALLET", body: "PLEASE_WAIT"});
                        var t = (new Date).getTime();
                        $analytics.eventTrack("createNewWallet", {category: "Events"});

                        // generate support secret, 6 random digits
                        var supportSecret = randDigits(6);

                        var useCashAddress = CONFIG.NETWORKS[sdkService.getNetworkType()].CASHADDRESS;
                        return $scope.sdk.createNewWallet({
                            walletVersion: CONFIG.DEFAULT_WALLET_VERSION,
                            identifier: $scope.setupInfo.identifier,
                            password: $scope.setupInfo.password,
                            support_secret: supportSecret,
                            useCashAddress: useCashAddress,
                            keyIndex: CONFIG.DEVKEYINDEX || 0
                        })
                            .progress(function(progress) {
                                /*
                                 * per step we increment the progress bar and display some new progress text
                                 * some of the text doesn't really match what is being done,
                                 * but we just want the user to feel like something is happening.
                                 */
                                switch (progress) {
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_START:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "PLEASE_WAIT"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_SECRET:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_GENERATE_PRIMARYKEY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_PRIMARY:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_GENERATE_BACKUPKEY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_ENCRYPT_RECOVERY:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_GENERATE_RECOVERY"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_PRIMARY:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_INIT_KEYS"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_BACKUP:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_INIT_KEYS"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_SUBMIT:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_SUBMIT_WALLET"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_INIT:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_INIT_WALLET"});
                                        break;
                                    case blocktrailSDK.CREATE_WALLET_PROGRESS_DONE:
                                        $scope.updateProgress({title: "CREATING_WALLET", body: "CREATING_DONE"});
                                        break;
                                }

                            })
                            .spread(function(wallet, backupInfo, more) {
                                $log.debug("new wallet created in [" + ((new Date).getTime() - t) + "ms]");
                                $scope.setupInfo.backupInfo = backupInfo;
                                $scope.setupInfo.backupInfo.supportSecret = supportSecret;

                                return $q.when(wallet);
                            })
                            ;
                    } else if (error.message.match(/password/) || error instanceof blocktrailSDK.WalletDecryptError) {
                        console.log("wallet init failed, error:",error);
                        // wallet exists but with different password
                        $log.debug("wallet with identifier [" + $scope.setupInfo.identifier + "] already exists, prompting for old password");

                        return $scope.alert({
                            title: $translate.instant("SETUP_EXISTING_WALLET"),
                            body: $translate.instant("MSG_WALLET_PASSWORD_MISMATCH")
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
                    var secretHex = null;
                    if (wallet.walletVersion === "v2") {
                        secretHex = wallet.secret;
                    } else {
                        secretHex = wallet.secret.toString("hex");
                    }

                    // while logging in we stash the secret so we can decrypt the glidera accesstoken
                    launchService.stashWalletSecret(secretHex);
                    wallet.lock();
                })
                .then(function() {
                    //set the wallet as the main wallet
                    $log.debug("setting wallet as main wallet");
                    $scope.updateProgress({title: "PREPARING_WALLET"});
                    return $scope.sdk.setMainMobileWallet($scope.setupInfo.identifier);
                })
                .then(function() {
                    // store the identity and encrypted password
                    $log.debug("saving wallet info", $scope.setupInfo.identifier, null);
                    return launchService.storeWalletInfo($scope.setupInfo.identifier, $scope.sdkReadOnlyObject.networkType);
                })
                .then(function() {
                    // clear sensitive data
                    $scope.setupInfo.password = null;

                    if ($scope.setupInfo.backupInfo) {
                        //store the backup info temporarily
                        $log.debug("saving backup info");
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
                            blocktrailPublicKeys: pubKeys,
                            supportSecret: $scope.setupInfo.backupInfo.supportSecret
                        });
                    } else {
                        return;
                    }
                })
                .then(function() {
                    $log.debug("All done. Onwards to victory!");
                    if ($scope.setupInfo.backupInfo) {
                        trackingService.trackEvent(trackingService.EVENTS.SIGN_UP);

                        //if a new wallet has been created, go to the wallet backup page
                        $state.go("app.setup.walletBackup");
                    } else {
                        trackingService.trackEvent(trackingService.EVENTS.LOGIN);

                        $state.go('app.wallet.summary');
                    }
                })
                .catch(function(e) {
                    $log.error(e);
                    $scope.working = false;

                    if (e == "CANCELLED" || e == "dismiss") {
                        //user canceled action
                        return false;
                    } else {
                        $scope.progressStatus = {title: "FAIL", header_class: "text-bad", body: e.toString()};
                    }
                });
        };

        /**
         * prompt for a correct wallet password - repeats on bad password
         */
        $scope.promptWalletPassword = function() {
            //prompt for a correct wallet password and retry the wallet creation process
            return dialogService.prompt({
                title: $translate.instant("SETUP_WALLET_PASSWORD"),
                body: $translate.instant("MSG_WALLET_PASSWORD"),
                input_type: "password",
                icon: "key"
            }).result
                .then(
                    function(dialogResult) {
                        $scope.setupInfo.password = dialogResult.trim();

                        //try the new password
                        $log.debug("re-initialising wallet with new password: " + $scope.setupInfo.identifier);
                        var useCashAddress = CONFIG.NETWORKS[sdkService.getNetworkType()].CASHADDRESS;

                        return $scope.sdk.initWallet({
                            identifier: $scope.setupInfo.identifier,
                            password: $scope.setupInfo.password,
                            useCashAddress: useCashAddress
                        })
                            .then(function(wallet) {
                                //success, password is correct. We can continue
                                return $q.when(wallet);
                            }, function(error) {
                                if (error.message.match(/password/) || error instanceof blocktrailSDK.WalletDecryptError) {
                                    //password still incorrect, try again
                                    return $scope.alert($translate.instant("MSG_BAD_PWD"), $translate.instant("MSG_TRY_AGAIN"))
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
                        return $q.reject("CANCELLED");
                    }
                );
        };

        $scope.setupWallet();
    }
})();
