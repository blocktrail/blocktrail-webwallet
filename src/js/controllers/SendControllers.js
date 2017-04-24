angular.module('blocktrail.wallet')
    .controller('SendCtrl', function($scope, $log, $modal, CurrencyConverter, Currencies, Contacts, Wallet, $timeout, dialogService,
                                     QR, $q, $state, $rootScope, $translate, launchService, CONFIG) {
        //$scope.fiatFirst = false;
        $rootScope.pageTitle = 'SEND';
        $scope.sendInput = {
            recipientAddress: "",
            referenceMessage: "",
            pin: null,
            amount: "",
            useOptimalFee: true
        };

        $scope.fees = {
            optimal: null,
            lowPriority: null
        };

        $scope.working = false;
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
                return currency.code != currencyType;
            });

            $scope.currencyType = currencyType;
            $scope.setAltCurrency();
        };

        $scope.setAltCurrency = function() {
            if ($scope.currencyType == 'BTC') {
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
                        wallet.maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY)
                    ]).then(function (results) {
                        // set the local stored value
                        _maxSpendable = {};
                        _maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL] = results[0];
                        _maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY] = results[1];

                        _maxSpendablePromise = null; // unset promise, it's done
                        return _maxSpendable;
                    });
                });

                return _maxSpendablePromise;
            }
        };

        $scope.fetchFee = function() {
            // reset state
            $scope.fees.lowPriority = 0;
            $scope.fees.optimal = 0;
            $scope.displayFee = false;

            Wallet.sdk.then(function(sdk) {
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
                    var fakeP2SHScript = bitcoinjs.scripts.scriptHashOutput(new blocktrailSDK.Buffer("0000000000000000000000000000000000000000", 'hex'));
                    var fakeAddress = bitcoinjs.Address.fromOutputScript(fakeP2SHScript, sdk.network);
                    localPay[fakeAddress.toString()] = amount;
                }

                Wallet.wallet.then(function (wallet) {
                    return $q.all([
                        wallet.coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY)
                            .spread(function (utxos, fee, change, feeOptions) {
                                $log.debug('lowPriority fee: ' + $scope.fees.lowPriority);

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
                            .spread(function (utxos, fee, change, feeOptions) {
                                $log.debug('optimal fee: ' + $scope.fees.optimal);

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
                            })
                    ])
                        .then(function (res) {
                            var lowPriorityFee = res[0];
                            var optimalFee = res[1];

                            $scope.fees.lowPriority = lowPriorityFee;
                            $scope.fees.optimal = optimalFee;
                            $scope.displayFee = true;

                            $scope.updateFee();
                        }, function (e) {
                            $log.debug("fetchFee ERR " + e);
                        });
                });
            });
        };

        $scope.updateFee = function() {
            $scope.fee = ($scope.sendInput.useOptimalFee) ? $scope.fees.optimal : $scope.fees.lowPriority;
        };

        $scope.confirmSend = function() {
            if ($scope.working) {
                return false;
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
                                    useOptimalFee: $scope.sendInput.useOptimalFee,
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
            return wallet.coinSelection($scope.pay, false, $scope.useZeroConf, $scope.sendData.useOptimalFee ? null : 'low_priority')
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

                    var feeStrategy = ($scope.sendData.useOptimalFee)
                        ? blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL
                        : blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY;

                    return $q.when(wallet.pay($scope.pay, false, $scope.useZeroConf, false, feeStrategy, $scope.form.two_factor_token)).then(function(txHash) {
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
