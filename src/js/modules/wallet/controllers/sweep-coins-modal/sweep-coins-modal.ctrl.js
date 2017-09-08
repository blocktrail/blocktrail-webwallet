(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("SweepCoinsModalController", SweepCoinsModalController);

    function SweepCoinsModalController($scope, $modalInstance, sweeperService, sdkService, walletsManagerService, CONFIG, dialogService,
                                        $translate, $log, $timeout, trackingService) {

        var activeWallet = walletsManagerService.getActiveWallet();

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

        $scope.sweepData = {
            rawTx: null,
            txId: null,
            feePaid: null,
            inputCount: null,
            totalValue: null
        };

        var options = {
            batchSize: 50,
            accountBatchSize: 5,
            network: CONFIG.NETWORK,
            testnet: CONFIG.TESTNET
        };

        activeWallet.getNewAddress().then(function (address) {
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

        $scope.startSweepingBIP44 = function() {
            $scope.working = true;
            $scope.discovering = true;
            sweeperService.bip44Sweep(($scope.form.mnemonic || "").trim().replace(/  +/g, ' '), options).then(function (result) {
                $scope.working = false;
                $scope.discovering = false;

                sweeperService.submitDebugInfo();

                if (result) {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_BALANCE);
                    $scope.sweepData = result;
                    $scope.form.step = $scope.STEPS.SWEEP;
                } else {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_NO_BALANCE);
                    return dialogService.alert(
                        $translate.instant("IMPORT_ERROR"),
                        $translate.instant("NO_BALANCES_FOUND")
                    ).result;
                }
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

            console.log(WIFs);

            sweeperService.wifSweep(WIFs, options).then(function (result) {
                $scope.working = false;
                $scope.discovering = false;

                sweeperService.submitDebugInfo();

                if (result) {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_BALANCE);
                    $scope.sweepData = result;
                    $scope.form.step = $scope.STEPS.SWEEP;
                } else {
                    trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_NO_BALANCE);
                    return dialogService.alert(
                        $translate.instant("IMPORT_ERROR"),
                        $translate.instant("NO_BALANCES_FOUND")
                    ).result;
                }
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

        $scope.publishRawTransaction = function () {
            sdkService.sdk().then(function (sdk) {
                sdk.sendRawTransaction($scope.sweepData.rawTx, function (err, result) {
                    $scope.working = false;

                    if(result.hash) {
                        $timeout(function() {
                            $scope.sweepData.txId = result.hash;
                            $scope.form.step = $scope.STEPS.PUBLISH;
                        });
                        trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_SUCCESS);
                    } else {
                        trackingService.trackEvent(trackingService.EVENTS.SWEEP.SWEEP_FAIL);
                        return dialogService.alert(
                            $translate.instant("IMPORT_ERROR"),
                            $translate.instant("TX_CANT_BE_PUSHED")
                        ).result;
                    }
                });
            });
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
