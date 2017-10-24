(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("SendCtrl", SendCtrl);

    function SendCtrl($scope, $rootScope, $translate, $log, $modal, bitcoinJS, CurrencyConverter, Currencies, activeWallet,
                      $timeout, dialogService, $q, launchService, CONFIG, settingsService, $stateParams) {

        var walletData = activeWallet.getReadOnlyWalletData();
        var settingsData = settingsService.getReadOnlySettingsData();
        // get current active wallets native currency
        var nativeCurrency = CONFIG.NETWORKS[walletData.networkType].TICKER;

        var maxSpendable = null;
        var maxSpendablePromise = null;

        $rootScope.pageTitle = "SEND";

        $scope.isLoading = true;

        $scope.settings = settingsData;

        //$scope.fiatFirst = false;
        $scope.OPTIMAL_FEE = "optimal";
        $scope.LOW_PRIORITY_FEE = "low_priority";
        $scope.PRIOBOOST = "prioboost";

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

        $scope.errors = {
            amount: false,
            recipient: false
        };

        $scope.complete = false;
        $scope.displayFee = false;
        $scope.useZeroConf = true;

        $scope.requires2FA = null;

        $scope.currencies = null;
        $scope.currencyType = null;
        $scope.altCurrency = {};

        $scope.$on("enabled_currency", function() {
            updateCurrentType($scope.currencyType);
        });

        // Methods
        $scope.updateCurrentType = updateCurrentType;
        $scope.setAltCurrency = setAltCurrency;
        $scope.fetchFee = fetchFee;
        $scope.resetError = resetError;
        $scope.onSubmitFormSend = onSubmitFormSend;

        initData();

        /**
         * Init data
         */
        function initData() {
            // set default BTC
            updateCurrentType(nativeCurrency);

            $q.all([launchService.getAccountInfo(), getMaxSpendable()])
                .then(function(data) {
                    var accountInfo = data[0];
                    var maxSpendable = data[1][blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE];

                    $scope.requires2FA = accountInfo.requires2FA;

                    $scope.prioboost.credits = maxSpendable.prioboost_remaining;
                    $scope.prioboost.discountP = (1 - (maxSpendable.fees.min_relay_fee / maxSpendable.fees.optimal)) * 100;

                    $scope.isLoading = false;
                });
        }

        // Fetch state parameters if provided
        fetchBitcoinURLParams();
        function fetchBitcoinURLParams() {

            if ($stateParams.address) {
                var address = $stateParams.address;

                activeWallet.validateAddress(address)
                    .then(function (address) {
                        if (address) {
                            $scope.sendInput.recipientAddress = address;
                        }
                    });
            }

            if ($stateParams.amount) {
                var amount = parseFloat($stateParams.amount);

                if (amount) {
                    $scope.sendInput.amount = amount;
                }
            }
        }

        checkBitcoinURLHandlerSet();
        function checkBitcoinURLHandlerSet() {

            var currTimestamp = ((new Date()).getTime() / 1000).toFixed(0);
            var currNotifyCounter = settingsData.registerURIHandlerNotifyCounter;
            var currLastNotifyTimestamp = settingsData.registerURIHandlerNotifyTimestamp;

            if (currNotifyCounter < settingsData.registerURIHandlerNotifyCounterMax &&
                currTimestamp - currLastNotifyTimestamp > settingsData.registerURIHandlerNotifyTimestampDelta) {
                // Bump notify counter AND timestamp of notify
                settingsService.updateSettingsUp({
                    registerURIHandlerNotifyCounter: currNotifyCounter + 1,
                    registerURIHandlerNotifyTimestamp: currTimestamp
                }).then(function() {
                    return dialogService.alert(
                        "Make BTC.com your default wallet",
                        "You can make your BTC.com wallet your default wallet for payments in your browser.\n" +
                        "Do you want to enable this feature?\n" +
                        "You can also set this up later in the Settings.",
                        $translate.instant("YES"),
                        $translate.instant("NO")
                        // If ok has been clicked
                    ).result.then(function() {

                        settingsService.updateSettingsUp({
                            registerURIHandlerExecuted: true
                        }).then(function () {
                            try {
                                $log.debug('Trying to register bitcoin URI scheme');
                                navigator.registerProtocolHandler(
                                    'bitcoin',
                                    CONFIG.WALLET_URL + '/#/wallet/handleURI/%s',
                                    'BTC.com Bitcoin Wallet'
                                );
                            } catch (e) {
                                $log.error('Couldn\'t register bitcoin: URL scheme', e, e.message);
                            }
                        });
                    });
                });
            }
        }

        /**
         * Update currency type
         * @param currencyType
         */
        function updateCurrentType(currencyType) {
            $scope.currencies = Currencies.getCurrencies();

            // filter out crypto currencies that are not current
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.isFiat || currency.code === nativeCurrency;
            });

            // filter out selected currency
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            $scope.currencyType = currencyType;

            setAltCurrency();
        }

        /**
         * Set alt currency
         */
        function setAltCurrency() {
            if ($scope.currencyType === nativeCurrency) {
                $scope.altCurrency.code = $scope.settings.localCurrency;
                $scope.altCurrency.amount = parseFloat(CurrencyConverter.fromBTC($scope.sendInput.amount, $scope.settings.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code = nativeCurrency;
                $scope.altCurrency.amount = parseFloat(CurrencyConverter.toBTC($scope.sendInput.amount, $scope.currencyType, 6)) || 0;
            }
        }

        /**
         * Get max spendable
         * @return {*}
         */
        function getMaxSpendable() {
            if (maxSpendable !== null) {
                return $q.when(maxSpendable);
            } else if (maxSpendablePromise !== null) {
                return maxSpendablePromise;
            } else {
                maxSpendablePromise = $q.all([
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL),
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY),
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                ]).then(function(results) {
                    // set the local stored value
                    maxSpendable = {};
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL] = results[0];
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY] = results[1];
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE] = results[2];

                    maxSpendablePromise = null; // unset promise, it's done
                    return maxSpendable;
                });

                return maxSpendablePromise;
            }
        }

        /**
         * Fetch fee
         */
        function fetchFee() {
            // reset state
            $scope.fees.lowPriority = null;
            $scope.fees.optimal = null;
            $scope.fees.minRelayFee = null;
            $scope.displayFee = false;
            $scope.prioboost.possible = null;
            $scope.prioboost.estSize = null;
            $scope.prioboost.zeroConf = null;

            var localPay = {};
            var amount = 0;

            if ($scope.currencyType === nativeCurrency) {
                amount = $scope.sendInput.amount;
            } else {
                amount = $scope.altCurrency.amount;
            }

            amount = parseInt(CurrencyConverter.toSatoshi(amount, "BTC"));

            // halt if input is 0
            if (amount <= 0) {
                return $q.reject(new Error("Amount needs to be > 0"));
            }

            // either use the real destination address or otherwise use a fake address
            if ($scope.sendInput.recipientAddress) {
                localPay[$scope.sendInput.recipientAddress] = amount;
            } else {
                var fakeP2SHScript = bitcoinJS.script.scriptHash.output.encode(new blocktrailSDK.Buffer("0000000000000000000000000000000000000000", "hex"));
                var fakeAddress = bitcoinJS.address.fromOutputScript(fakeP2SHScript, activeWallet.getSdkWallet().sdk.network);
                localPay[fakeAddress.toString()] = amount;
            }

            return $q.all([
                activeWallet
                    .getSdkWallet()
                    .coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY)
                    .spread(function(utxos, fee, change, res) {
                        $log.debug("lowPriority fee: " + fee);

                        return fee;
                    })
                    .catch(function(e) {
                        // when we get a fee error we use maxspendable fee
                        if (e instanceof blocktrail.WalletFeeError || (e instanceof Error && e.message === "Wallet balance too low")) {
                            return getMaxSpendable().then(function(maxSpendable) {
                                var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY].fee;
                                $log.debug("lowPriority fee MAXSPENDABLE: " + fee);
                                return fee;
                            });
                        } else {
                            throw e;
                        }
                    }),
                activeWallet
                    .getSdkWallet()
                    .coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL)
                    .spread(function(utxos, fee, change, res) {
                        $log.debug("optimal fee: " + fee);

                        return fee;
                    })
                    .catch(function(e) {
                        // when we get a fee error we use maxspendable fee
                        if (e instanceof blocktrail.WalletFeeError || (e instanceof Error && e.message === "Wallet balance too low")) {
                            return getMaxSpendable()
                                .then(function(maxSpendable) {
                                    var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL].fee;
                                    $log.debug("optiomal fee MAXSPENDABLE: " + fee);
                                    return fee;
                                });
                        } else {
                            throw e;
                        }
                    }),
                activeWallet
                    .getSdkWallet()
                    .coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                    .spread(function(utxos, fee, change, res) {
                        $log.debug("minRelayFee fee: " + fee);

                        $scope.prioboost.estSize = res.size;
                        $scope.prioboost.credits = res.prioboost_remaining;
                        $scope.prioboost.zeroConf = res.zeroconf;
                        $scope.prioboost.tooLarge = $scope.prioboost.estSize > $scope.PRIOBOOST_MAX_SIZE;
                        $scope.prioboost.possible = !$scope.prioboost.zeroConf && !$scope.prioboost.tooLarge && $scope.prioboost.credits > 0;

                        return fee;
                    })
                    .catch(function(e) {
                        // when we get a fee error we use maxspendable fee
                        if (e instanceof blocktrail.WalletFeeError || (e instanceof Error && e.message === "Wallet balance too low")) {
                            return getMaxSpendable()
                                .then(function(maxSpendable) {
                                    var fee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE].fee;
                                    $log.debug("minRelayFee fee MAXSPENDABLE: " + fee);
                                    return fee;
                                });
                        } else {
                            throw e;
                        }
                    })
            ])
                .then(function(res) {
                    var lowPriorityFee = res[0];
                    var optimalFee = res[1];
                    var minRelayFee = res[2];

                    $scope.fees.lowPriority = lowPriorityFee;
                    $scope.fees.optimal = optimalFee;
                    $scope.fees.minRelayFee = minRelayFee;
                    $scope.displayFee = true;

                    return updateFee();
                }, function(e) {
                    $log.debug("fetchFee ERR " + e);
                });
        }

        /**
         * Update fee
         */
        function updateFee() {
            if ($scope.sendInput.feeChoice === $scope.OPTIMAL_FEE) {
                $scope.fee = $scope.fees.optimal;
            } else if ($scope.sendInput.feeChoice === $scope.LOW_PRIORITY_FEE) {
                $scope.fee = $scope.fees.lowPriority;
            } else if ($scope.sendInput.feeChoice === $scope.PRIOBOOST) {
                $scope.fee = $scope.fees.minRelayFee;
            } else {
                throw new Error("Invalid");
            }
        }

        /**
         * On submit form send
         */
        function onSubmitFormSend() {
            $scope.isLoading = true;

            return $scope
                .fetchFee()
                .then(validateData)
                .then(
                    function(sendAmount) {
                        $scope.isLoading = false;

                        $modal.open({
                            controller: "SendConfirmModalCtrl",
                            templateUrl: "js/modules/wallet/controllers/send-confirm-modal/send-confirm-modal.tpl.html",
                            size: "md",
                            backdrop: "static",
                            resolve: {
                                activeWallet: function() {
                                    return activeWallet;
                                },
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
                    function() {
                        $scope.isLoading = false;
                    });
        }

        /**
         * Validate data
         */
        function validateData() {
            var sendAmount = 0;
            var isValid = true;

            clearErrors();

            if ($scope.sendInput.feeChoice === $scope.PRIOBOOST && $scope.prioboost.possible === false) {
                var body = $scope.prioboost.credits <= 0 ? $translate.instant("PRIOBOOST_NO_CREDITS") : ($scope.prioboost.tooLarge ? $translate.instant("PRIOBOOST_TOO_LARGE") : $translate.instant("PRIOBOOST_ZERO_CONF"));
                var title = $translate.instant("PRIOBOOST_NOT_POSSIBLE");

                dialogService
                    .alert({
                        body: body,
                        title: title
                    });

                isValid = false;
            }

            // input amount
            // https://stackoverflow.com/questions/7810446/regex-validation-of-numeric-with-up-to-4-decimal-places
            if (!$scope.sendInput.amount || !$scope.sendInput.amount.toString().match("^[0-9]*(?:\.[0-9]{0,8})?$")) {
                $scope.errors.amount = "MSG_INVALID_AMOUNT";
                isValid = false;
            }

            if (parseFloat($scope.sendInput.amount).toFixed(8) === "0.00000000") {
                $scope.errors.amount = "MSG_INVALID_AMOUNT";
                isValid = false;
            }

            if ($scope.currencyType === nativeCurrency) {
                sendAmount = $scope.sendInput.amount;
            } else {
                sendAmount = $scope.altCurrency.amount;
            }

            if (parseInt(CurrencyConverter.toSatoshi(sendAmount, "BTC")) >= ($scope.walletData.balance + $scope.walletData.uncBalance)) {
                $scope.errors.amount = "MSG_INSUFFICIENT_FUNDS";
                isValid = false;
            }

            // no send address
            if (!$scope.sendInput.recipientAddress) {
                $scope.errors.recipient = "MSG_MISSING_RECIPIENT";
                isValid = false;
            }

            if (isValid) {
                return activeWallet
                    .validateAddress($scope.sendInput.recipientAddress)
                    .then(function() {
                        return sendAmount;
                    })
                    .catch(function() {
                        $scope.errors.recipient = "MSG_INVALID_RECIPIENT";
                        return $q.reject();
                    });
            } else {
                return $q.reject();
            }
        }

        /**
         * Clear errors
         */
        function clearErrors() {
            $scope.errors.amount = false;
            $scope.errors.recipient = false;
        }

        /**
         * Clear error
         * @param type
         */
        function resetError(type) {
            $scope.errors[type] = false;
        };
    }
})();
