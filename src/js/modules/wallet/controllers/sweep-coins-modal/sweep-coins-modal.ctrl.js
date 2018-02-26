(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("SweepCoinsModalController", SweepCoinsModalController);

    function SweepCoinsModalController($scope, $modalInstance, sweeperService, sdkService, walletsManagerService, CONFIG, dialogService,
                                        $translate, $log, $timeout, trackingService, $q) {

        var activeWallet = walletsManagerService.getActiveWallet();
        var walletData = activeWallet.getReadOnlyWalletData();
        $scope.networkType = walletData.networkType;

        trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_START);

        $scope.bip39EN = blocktrailSDK.bip39wordlist;

        $scope.working = true;
        $scope.discovering = false;

        $scope.STEPS = {
            WELCOME: 'WELCOME',
            WIF: 'WIF',
            BIP44: 'BIP44',
            SWEEP: 'SWEEP',
            PUBLISH: 'PUBLISH'
        };

        $scope.form = {
            step: $scope.STEPS.WELCOME,
            mnemonic: null,
            inputWIF: null
        };

        $scope.sweepData = [
            {
                rawTx: null,
                txId: null,
                feePaid: null,
                inputCount: null,
                totalValue: null
            }
        ];

        $scope.displaySweepData = {
            totalValue: null,
            totalFeePaid: null
        };

        var options = {
            batchSize: 50,
            accountBatchSize: 5,
            network: walletData.networkType,
            testnet: false
        };

        if (options.network.substr(0, 1) === "t") {
            options.network = options.network.substr(1);
            options.testnet = true;
        } else if (options.network.substr(0, 1) === "r") {
            options.network = options.network.substr(1);
            options.regtest = true;
        }

        activeWallet.getNewAddress().then(function (address) {
            // Convert to legacy address format if Bitcoin Cash address
            if (walletData.networkType === 'BCC' || walletData.networkType === 'tBCC') {
                address = activeWallet.getSdkWallet().sdk.getLegacyBitcoinCashAddress(address);
            }

            options.recipient = address;
            $scope.working = false;
        });

        $scope.$watch('form.mnemonic', function (newVal, oldVal) {
            function strcmp (a, b) {
                return (a < b ? -1 : ( a > b ? 1 : 0 ));
            }
            // Remove line breaks
            if ($scope.form.mnemonic && $scope.form.mnemonic.length > 0) {
                $scope.form.mnemonic = $scope.form.mnemonic.replace(/[\r\n]+/g, " ").toLowerCase(); // https://stackoverflow.com/a/34936253
            }

            if (newVal && oldVal) {
                var oldWords = oldVal.split(' ');
                // If we add a word
                if (newVal.split(' ').length == 1 && oldWords.length > 1) {
                    delete oldWords[oldWords.length - 1];
                    // Special case when removing last word
                    if (strcmp(oldVal, newVal + ' ' + newVal[0])) {
                        $scope.form.mnemonic = oldWords.join(' ') + newVal + ' ';
                    } else {
                        $scope.form.mnemonic = oldWords.join(' ').slice(0, -1);
                    }
                }
            }
        });
        $scope.startSweeping = function() {
            if ($scope.form.step === $scope.STEPS.BIP44) {
                $scope.startSweepingBIP44();
            } else {
                $scope.startSweepingWIF();
            }
        };

        var processSweepResults = function (results) {
            $scope.working = false;
            $scope.discovering = false;

            sweeperService.submitDebugInfo();

            // Some are positive balance transactions, some below dust value
            var somePositiveBalances = results.some(function (result) {
                return !!result;
            });

            // If some transactions failed, we need to notify the user
            var someFailedTransactions = !results.every(function (result) {
                return !!result;
            });

            // Add to absolute value to display before sending
            results.map(function (result) {
                $scope.displaySweepData.totalValue += result.totalValue;
                $scope.displaySweepData.totalFeePaid += result.feePaid;
            });

            var goToSweepState = function () {
                if (results && results.length && somePositiveBalances) {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_BALANCE);
                    $scope.sweepData = results;
                    $scope.form.step = $scope.STEPS.SWEEP;
                } else {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_NO_BALANCE);
                    return dialogService.alert(
                        $translate.instant("IMPORT_ERROR"),
                        $translate.instant("NO_BALANCES_FOUND")
                    ).result;
                }
            };

            if(results && someFailedTransactions) {
                return dialogService.alert(
                    $translate.instant("IMPORT_ERROR"),
                    $translate.instant("SOME_TRANSACTIONS_FAILED")
                ).result.then(function () {
                    goToSweepState();
                })
            } else {
                goToSweepState();
            }
        };

        $scope.startSweepingBIP44 = function() {
            $scope.working = true;
            $scope.discovering = true;
            sweeperService.bip44Sweep(($scope.form.mnemonic || "").trim().replace(/  +/g, ' '), options).then(function (results) {
                processSweepResults(results)
            }).catch(function (error) {
                $scope.working = false;
                $scope.discovering = false;
                $log.error(error);
                return dialogService.alert(
                    $translate.instant("IMPORT_ERROR"),
                    $translate.instant("INVALID_MNEMONIC")
                ).result;
            });
        };

        $scope.startSweepingWIF = function() {
            $scope.working = true;
            $scope.discovering = true;

            var WIFs = ($scope.form.inputWIF || "").trim().replace(/  +/g, ' ').replace(/\r\n/g, ',').replace(/\n/g, ',').replace(/ /g, ',');
            WIFs = WIFs.split(',').filter(function(WIF) { return !!WIF.trim(); });

            sweeperService.wifSweep(WIFs, options)
                .then(function (results) {
                    processSweepResults(results)
                })
                .catch(function (error) {
                    $scope.working = false;
                    $scope.discovering = false;
                    $log.error(error);
                    return dialogService.alert(
                        $translate.instant("IMPORT_ERROR"),
                        $translate.instant("INVALID_MNEMONIC")
                    ).result;
                });
        };

        $scope.publishRawTransaction = function () {
            var sdk = activeWallet.getSdkWallet().sdk;

            var transactions = $scope.sweepData.map(function (sweepTx) {
                return sdk.sendRawTransaction(sweepTx.rawTx)
                    .then(function (result) {
                        sweepTx.txId = result.hash;
                        return {
                            status: true,
                            sweep: sweepTx,
                            txId: result.hash
                        }
                    }, function (err) {
                        return {
                            status: false,
                            sweep: sweepTx,
                            err: err
                        }
                    });
                });

                $q.all(transactions).then(function (results) {
                    $scope.working = false;
                    var failures = 0;
                    results.map(function (result) {
                        if(!result.status) {
                            failures += 1;
                        }
                    });

                    if (!failures) {
                        $timeout(function () {
                            $scope.form.step = $scope.STEPS.PUBLISH;
                        });
                        trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_SUCCESS);
                    } else {
                        trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_FAIL);

                        // Differentiate between one and more failing transactions
                        var msg = 'TX_CANT_BE_PUSHED';
                        if (failures > 1) {
                            msg = 'TX_CANT_BE_PUSHED_MULTIPLE';
                        }

                        return dialogService.alert(
                            $translate.instant("IMPORT_ERROR"),
                            $translate.instant(msg, { amount: failures })
                        ).result;
                    }
                })
        };

        $scope.done = function() {
            $timeout(function() {
                $state.go('app.wallet.summary');
            });
            $modalInstance.close();
        };

        $scope.dismiss = function() {
            $modalInstance.close();
        };
    }
})();
