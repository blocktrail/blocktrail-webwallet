angular.module('blocktrail.wallet')
    .controller('SendCtrl', function($scope, $log, $modal, bitcoinJS, CurrencyConverter, Currencies, Contacts, Wallet, $timeout, dialogService,
                                     QR, $q, $state, $rootScope, $translate, launchService) {
        //$scope.fiatFirst = false;
        $scope.OPTIMAL_FEE = 'optimal';
        $scope.LOW_PRIORITY_FEE = 'low_priority';
        $scope.PRIOBOOST = 'prioboost';

        $rootScope.pageTitle = 'SEND';
        $scope.PRIOBOOST_MAX_SIZE = 1300;
        $scope.prioboost = {
            discountP: null,
            credits: 2,
            possible: null,
            estSize: null,
            tooLarge: false,
            zeroConf: false
        };
        $scope.sendInput = {
            recipientAddress: "",
            referenceMessage: "",
            pin: null,
            amount: "",
            feeChoice: $scope.OPTIMAL_FEE
        };

        $scope.fees = {
            optimal: null,
            lowPriority: null,
            minRelayFee: null
        };

        $scope.complete = false;
        $scope.displayFee = false;
        $scope.useZeroConf = true;

        $scope.clearErrors = function() {
            $scope.errors = {
                amount     : false,
                recipient  : false
            };
        };

        $scope.requires2FA = null;
        launchService.getAccountInfo().then(function(accountInfo) {
            $scope.requires2FA = accountInfo.requires2FA;
        });

        $scope.currencies   = null;
        $scope.currencyType = null;
        $scope.altCurrency  = {};
        $scope.updateCurrentType = function(currencyType) {
            $scope.currencies = Currencies.getFiatCurrencies();
            $scope.currencies.unshift({code: 'BTC', 'symbol': 'BTC'});
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            $scope.currencyType = currencyType;
            $scope.setAltCurrency();
        };

        $scope.$on('enabled_currency', function() {
            $scope.updateCurrentType($scope.currencyType);
        });

        $scope.setAltCurrency = function() {
            if ($scope.currencyType === 'BTC') {
                $scope.altCurrency.code     = $scope.settings.localCurrency;
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.fromBTC($scope.sendInput.amount, $scope.settings.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code     = 'BTC';
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.toBTC($scope.sendInput.amount, $scope.currencyType, 6)) || 0;
            }
        };

        // set default BTC
        $scope.updateCurrentType('BTC');

        var _maxSpendable = null;
        var _maxSpendablePromise = null;
        var maxSpendable = function() {
            if (_maxSpendable !== null) {
                return $q.when(_maxSpendable);
            } else if (_maxSpendablePromise !== null) {
                return _maxSpendablePromise;
            } else {
                _maxSpendablePromise = Wallet.wallet.then(function (wallet) {
                    return $q.all([
                        wallet.maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL),
                        wallet.maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY),
                        wallet.maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                    ]).then(function (results) {
                        // set the local stored value
                        _maxSpendable = {};
                        _maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL] = results[0];
                        _maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY] = results[1];
                        _maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE] = results[2];

                        _maxSpendablePromise = null; // unset promise, it's done
                        return _maxSpendable;
                    });
                });

                return _maxSpendablePromise;
            }
        };

        maxSpendable().then(function(maxSpendable) {
            var _maxSpendable = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE];

            $scope.prioboost.credits = _maxSpendable.prioboost_remaining;
            $scope.prioboost.discountP = (1 - (_maxSpendable.fees.min_relay_fee / _maxSpendable.fees.optimal)) * 100;
        });

        $scope.fetchFee = function() {
            // reset state
            $scope.fees.lowPriority = null;
            $scope.fees.optimal = null;
            $scope.fees.minRelayFee = null;
            $scope.displayFee = false;
            $scope.prioboost.possible = null;
            $scope.prioboost.estSize = null;
            $scope.prioboost.zeroConf = null;

            return Wallet.sdk.then(function(sdk) {
                var localPay = {};
                var amount = 0;

                if ($scope.currencyType == 'BTC') {
                    amount = $scope.sendInput.amount;
                } else {
                    amount = $scope.altCurrency.amount;
                }
                amount = parseInt(CurrencyConverter.toSatoshi(amount, "BTC"));

                // halt if input is 0
                if (amount <= 0) {
                    return;
                }

                // either use the real destination address or otherwise use a fake address
                if ($scope.sendInput.recipientAddress) {
                    localPay[$scope.sendInput.recipientAddress] = amount;
                } else {
                    var fakeP2SHScript = bitcoinJS.scripts.scriptHashOutput(new blocktrailSDK.Buffer("0000000000000000000000000000000000000000", 'hex'));
                    var fakeAddress = bitcoinJS.Address.fromOutputScript(fakeP2SHScript, sdk.network);
                    localPay[fakeAddress.toString()] = amount;
                }

                return Wallet.wallet.then(function (wallet) {
                    return $q.all([
                        wallet.coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY)
                            .spread(function (utxos, fee, change, res) {
                                $log.debug('lowPriority fee: ' + fee);

                                return fee;
                            })
                            .catch(function(e) {
                                // when we get a fee error we use maxspendable fee
                                if (e instanceof blocktrail.WalletFeeError) {
                                    return maxSpendable().then(function(maxSpendable) {
                                        var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY].fee;
                                        $log.debug('lowPriority fee MAXSPENDABLE: ' + fee);
                                        return fee;
                                    })
                                } else {
                                    throw e;
                                }
                            }),
                        wallet.coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL)
                            .spread(function (utxos, fee, change, res) {
                                $log.debug('optimal fee: ' + fee);

                                return fee;
                            })
                            .catch(function(e) {
                                // when we get a fee error we use maxspendable fee
                                if (e instanceof blocktrail.WalletFeeError) {
                                    return maxSpendable().then(function(maxSpendable) {
                                        var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL].fee;
                                        $log.debug('optiomal fee MAXSPENDABLE: ' + fee);
                                        return fee;
                                    })
                                } else {
                                    throw e;
                                }
                            }),
                        wallet.coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                            .spread(function (utxos, fee, change, res) {
                                $log.debug('minRelayFee fee: ' + fee);

                                $scope.prioboost.estSize = res.size;
                                $scope.prioboost.credits = res.prioboost_remaining;
                                $scope.prioboost.zeroConf = res.zeroconf;
                                $scope.prioboost.tooLarge = $scope.prioboost.estSize > $scope.PRIOBOOST_MAX_SIZE;
                                $scope.prioboost.possible = !$scope.prioboost.zeroConf && !$scope.prioboost.tooLarge && $scope.prioboost.credits > 0;

                                return fee;
                            })
                            .catch(function(e) {
                                // when we get a fee error we use maxspendable fee
                                if (e instanceof blocktrail.WalletFeeError) {
                                    return maxSpendable().then(function(maxSpendable) {
                                        var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE].fee;
                                        $log.debug('minRelayFee fee MAXSPENDABLE: ' + fee);
                                        return fee;
                                    })
                                } else {
                                    throw e;
                                }
                            })
                    ])
                        .then(function (res) {
                            var lowPriorityFee = res[0];
                            var optimalFee = res[1];
                            var minRelayFee = res[2];

                            $scope.fees.lowPriority = lowPriorityFee;
                            $scope.fees.optimal = optimalFee;
                            $scope.fees.minRelayFee = minRelayFee;
                            $scope.displayFee = true;

                            return $scope.updateFee();
                        }, function (e) {
                            $log.debug("fetchFee ERR " + e);
                        });
                });
            });
        };

        $scope.updateFee = function() {
            if ($scope.sendInput.feeChoice === $scope.OPTIMAL_FEE) {
                $scope.fee = $scope.fees.optimal;
            } else if ($scope.sendInput.feeChoice === $scope.LOW_PRIORITY_FEE) {
                $scope.fee = $scope.fees.lowPriority;
            } else if ($scope.sendInput.feeChoice === $scope.PRIOBOOST) {
                $scope.fee = $scope.fees.minRelayFee;
            } else {
                throw new Error("Invalid");
            }
        };

        $scope.confirmSend = function() {
            var spinner = dialogService.spinner({});

            return $scope.fetchFee().then(function() {
                spinner.close();

                if ($scope.sendInput.feeChoice === $scope.PRIOBOOST && $scope.prioboost.possible === false) {
                    dialogService.alert({
                        body: $scope.prioboost.credits <= 0 ? $translate.instant("PRIOBOOST_NO_CREDITS") : ($scope.prioboost.tooLarge ? $translate.instant("PRIOBOOST_TOO_LARGE") : $translate.instant("PRIOBOOST_ZERO_CONF")),
                        title: $translate.instant("PRIOBOOST_NOT_POSSIBLE")
                    });
                    return;
                }

                $scope.clearErrors();

                // input amount
                // https://stackoverflow.com/questions/7810446/regex-validation-of-numeric-with-up-to-4-decimal-places
                if (!$scope.sendInput.amount || !$scope.sendInput.amount.match('^[0-9]*(?:\.[0-9]{0,8})?$')) {
                    $scope.errors.amount = 'MSG_INVALID_AMOUNT';
                    return;
                    //throw blocktrail.Error('MSG_INVALID_AMOUNT');
                }

                if (parseFloat($scope.sendInput.amount).toFixed(8) == '0.00000000') {
                    $scope.errors.amount = 'MSG_INVALID_AMOUNT';
                    return;
                }

                var sendAmount = 0;
                if ($scope.currencyType == 'BTC') {
                    sendAmount = $scope.sendInput.amount;
                } else {
                    sendAmount = $scope.altCurrency.amount;
                }

                if (parseInt(CurrencyConverter.toSatoshi(sendAmount, "BTC")) >= ($rootScope.balance + $rootScope.uncBalance)) {
                    $scope.errors.amount = 'MSG_INSUFFICIENT_FUNDS';
                    return;
                }

                //no send address
                if (!$scope.sendInput.recipientAddress) {
                    $scope.errors.recipient = 'MSG_MISSING_RECIPIENT';
                    return;
                }

                Wallet.validateAddress($scope.sendInput.recipientAddress)
                    .then(function() {
                            var modalInstance = $modal.open({
                                controller: 'SendConfirmCtrl',
                                templateUrl: 'templates/send/dialog.send-confirm.html',
                                size: 'md',
                                backdrop: 'static',
                                resolve: {
                                    sendData: function() {
                                        return {
                                            feeChoice: $scope.sendInput.feeChoice,
                                            recipientAddress: $scope.sendInput.recipientAddress,
                                            amount: sendAmount,
                                            requires2FA: $scope.requires2FA
                                        };
                                    }
                                }
                            });
                        },
                        function(err) {
                            $timeout(function() {
                                $scope.errors.recipient = 'MSG_INVALID_RECIPIENT';
                            });
                        })
                ;
            })
            .finally(function() {
                spinner.close();
            });
        };
    })
    .controller('SendResultCtrl', function($scope, $modalInstance, result) {
        $scope.result = result;

        $scope.$on('send:result', function(event, result) {
            $scope.result = result;
        });

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        };

        $scope.close = function() {
            $modalInstance.close();
        };
    })
    .controller('SendConfirmCtrl', function($scope, $rootScope, $modalInstance, $log, $translate, $q, $timeout, $state,
                                            CurrencyConverter, Wallet, sendData, FormHelper, $analytics, launchService) {
        $scope.sendData = sendData;
        $scope.complete = false;
        $scope.working = false;

        $scope.error = null;
        $scope.detailedError = null;

        $scope.form = {
            password : null,
            two_factor_token: null
        };


        $scope.pay = {};
        $scope.pay[$scope.sendData.recipientAddress] = parseInt(CurrencyConverter.toSatoshi($scope.sendData.amount, "BTC"));
        $scope.feeStrategy = $scope.sendData.feeChoice === 'prioboost' ? blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE : $scope.sendData.feeChoice;
        $scope.useZeroConf = true;

        $scope.passwordCapsLockOn = false;

        $scope.dismiss = function () {
            $scope.error = null;
            $modalInstance.dismiss();
        };

        $scope.submit = function(sendForm) {
            if ($scope.complete) {
                $modalInstance.dismiss();
                $state.go('app.wallet.summary');
            } else {
                $scope.confirmSend(sendForm);
            }
        };

        Wallet.wallet.then(function(wallet) {
            return wallet.coinSelection($scope.pay, false, $scope.useZeroConf, $scope.feeStrategy)
                .spread(function(utxos, fee, change, feeOptions) {
                    $scope.$apply(function() {
                        $scope.fee = fee;
                    });
                })
                ;
        }).catch(function(err) {
            $log.debug(err);
            $scope.fee = false;
        });

        $scope.confirmSend = function (sendForm) {
            if ($scope.working) return;

            FormHelper.setAllDirty(sendForm);

            if (sendForm.$invalid) {
                return false;
            }

            $scope.error = null;
            $scope.detailedError = null;
            $scope.working = true;
            $scope.progressWidth = 5;
            $scope.progressTimeout = $timeout(function() {
                if ($scope.progressWidth >= 90) {
                    $scope.progressWidth = 100;
                    return;
                }
                $scope.progressWidth += 20;
            }, 500);

            $q.when(Wallet.unlockWithPassword($scope.form.password))
                .then(function(wallet) {
                    $log.info("wallet: unlocked");
                    $log.info("wallet: paying", $scope.pay);

                    $analytics.eventTrack('pre-pay', {category: 'Events'});

                    return $q.when(wallet.pay($scope.pay, false, $scope.useZeroConf, false, $scope.feeStrategy, $scope.form.two_factor_token, {prioboost: $scope.sendData.feeChoice === 'prioboost'})).then(function(txHash) {
                        wallet.lock();
                        return $q.when(txHash);
                    }, function(err) {
                        wallet.lock();
                        return $q.reject(err);
                    });
                })
                .then(function(txHash) {
                    $analytics.eventTrack('pay', {category: 'Events'});

                    $log.info("wallet: paid", txHash);
                    $scope.error = null;
                    $scope.detailedError = null;
                    $scope.complete = true;
                    $scope.working = false;
                    $scope.txHash = txHash;

                    Wallet.pollTransactions();
                })
                .catch(function(err) {
                    $scope.error = null;
                    $scope.detailedError = null;
                    $scope.working = false;

                    $timeout.cancel($scope.progressTimeout);

                    if (err instanceof blocktrail.ContactAddressError) {
                        // error getting sending address
                        $scope.error = 'MSG_BAD_CONTACT';
                    } else if (err instanceof blocktrail.WalletPinError || err instanceof blocktrail.WalletChecksumError || err instanceof blocktrail.WalletDecryptError) {
                        FormHelper.setValidityOnce(sendForm.password, 'invalid');
                    } else if (err instanceof blocktrail.WalletMissing2FAError) {
                        // missmatch, 2FA might have been enabled in another tab or smt ...
                        if (!$scope.sendData.requires2FA) {
                            $scope.sendData.requires2FA = true;
                            launchService.updateAccountInfo({requires2FA: true});
                        }

                        FormHelper.setValidityOnce(sendForm.two_factor_token, 'required');

                    } else if (err instanceof blocktrail.WalletInvalid2FAError) {
                        FormHelper.setValidityOnce(sendForm.two_factor_token, 'invalid');

                    } else if (err instanceof blocktrail.WalletFeeError) {
                        $scope.error = 'MSG_LOW_BALANCE_FOR_FEE';
                    } else {
                        $log.error(err);
                        // other error
                        $scope.error = 'MSG_SEND_FAIL_UNKNOWN';
                        $scope.detailedError = ("" + err).replace(/^Error: /, "");
                    }
                })
            ;
        };

    })
;
