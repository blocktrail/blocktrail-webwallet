(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("SendCtrl", SendCtrl);

    function SendCtrl($scope, $state, $rootScope, $translate, $log, $modal, bitcoinJS, CurrencyConverter, Currencies, activeWallet,
        dialogService, $q, launchService, CONFIG, settingsService, $stateParams, walletsManagerService,
        NotificationsService, bitcoinLinkService) {

        var walletData = activeWallet.getReadOnlyWalletData();
        var settingsData = settingsService.getReadOnlySettingsData();
        // get current active wallets native currency
        var nativeCurrency = CONFIG.NETWORKS[walletData.networkType].TICKER;

        var maxSpendable = null;
        var maxSpendablePromise = null;

        var minSpendable = null;
        var minSpendablePromise = null;

        $rootScope.pageTitle = "SEND";

        $scope.isLoading = true;

        $scope.settings = settingsData;

        //$scope.fiatFirst = false;
        $scope.HIGH_PRIORITY_FEE = "high_priority";
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

        function isInitialDisableSendInput() {
            if (walletData.networkType !== 'BCC') {
                return false;
            }

            var isDisable = CONFIG.NETWORKS[walletData.networkType].DISABLE_SEND;
            var start = CONFIG.NETWORKS[walletData.networkType].DISABLE_SEND_START;
            var end = CONFIG.NETWORKS[walletData.networkType].DISABLE_SEND_END;
            var now = Math.round(new Date().getTime() / 1000);
            if (isDisable || (now >= start && now <= end)) {
                return true
            }
            return false;
        }

        $scope.sendInput = {
            recipientAddress: "",
            referenceMessage: "",
            pin: null,
            amount: "",
            feeChoice: $scope.OPTIMAL_FEE,
            // inputDisabled: false,// For BCH FORKING---
            inputDisabled: isInitialDisableSendInput(),// For BCH FORKING
            isForking: isInitialDisableSendInput()// For BCH FORKING
        };

        $scope.fees = {
            highPriority: null,
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

        $scope.$on("enabled_currency", function () {
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

            return launchService.getAccountInfo().then(function (accountInfo) {
                $scope.requires2FA = accountInfo.requires2FA;
                return getMaxSpendable().then(function (data) {
                    var maxSpendable = data[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE];

                    $scope.prioboost.credits = maxSpendable.prioboost_remaining;
                    $scope.prioboost.discountP = (1 - (maxSpendable.fees.min_relay_fee / maxSpendable.fees.optimal)) * 100;

                    $scope.isLoading = false;
                });
            }).catch(function () {
                $scope.isLoading = false;
            });
        }

        $scope.openModalBitcoinLink = function () {
            clearErrors();
            return dialogService.prompt({
                body: $translate.instant("BIP70_PASTE_TEXT", { network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG }),
                title: $translate.instant("BIP70_PASTE_TITLE", { network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG })
            })
                .result
                .then(function (result) {
                    return bitcoinLinkService.parse(result)
                        .then(function (sendInput) {
                            handleBitcoinPaymentScheme({ sendInput: sendInput });
                        }).catch(function (e) {
                            return dialogService.alert(
                                $translate.instant('ERROR_TITLE_3'),
                                $translate.instant('NOT_A_BITCOIN_LINK', {
                                    network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG
                                }),
                                $translate.instant('OK')
                            ).result;
                        });
                })
        };

        // Fetch state parameters if provided
        handleBitcoinPaymentScheme();
        /**
         * Handle state parameters about bitcoin payment information, if present
         */
        function handleBitcoinPaymentScheme(optionalScheme) {
            var scheme = null;
            if (optionalScheme) {
                scheme = optionalScheme
            } else {
                scheme = $stateParams;
            }
            console.log("handle uri scheme");

            if (scheme.sendInput) {
                // Open send in correct wallet network
                if (scheme.sendInput.network === "bitcoin" || scheme.sendInput.network === "bitcoincash") {
                    if (scheme.sendInput.network === "bitcoin" && walletData.networkType === "BCC") {
                        return switchWalletByNetworkTypeAndIdentifier('BTC', walletData.identifier);
                    } else if (scheme.sendInput.network === "bitcoincash:" && walletData.networkType === "BTC") {
                        return switchWalletByNetworkTypeAndIdentifier('BCC', walletData.identifier);
                    }
                }

                activeWallet.validateAddress(scheme.sendInput.recipientAddress)
                    .then(function () {
                        $scope.sendInput.inputDisabled = true;
                        $scope.sendInput = Object.assign($scope.sendInput, scheme.sendInput);
                        $scope.fetchFee();
                        angular.element(document).ready(function () {
                            // Update fiat price to display - keep fetching for price until available
                            var interval = setInterval(function () {
                                Currencies.updatePrices().then(function () {
                                    $scope.setAltCurrency();
                                    clearInterval(interval);
                                });
                            }, 350);
                        });
                    })
                    .catch(function (e) {
                        console.error(e);
                        $scope.clearRecipient();
                        return dialogService.alert(
                            $translate.instant('ERROR_TITLE_3'),
                            $translate.instant('NOT_A_BITCOIN_LINK', {
                                network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG
                            }),
                            $translate.instant('OK')
                        ).result;
                    });
            }
        }

        /**
         * Switches the wallet interface based on the network type and identifier
         * @param networkType Network type
         * @param identifier Wallet identifier
         */
        function switchWalletByNetworkTypeAndIdentifier(networkType, identifier) {
            $scope.isLoading = true;
            return walletsManagerService.setActiveWalletByNetworkTypeAndIdentifier(networkType, identifier)
                .then(function () {
                    $state.reload();
                    $scope.isLoading = false;
                });
        }

        NotificationsService.checkAndPromptBitcoinURIHandler();

        /**
         * Update currency type
         * @param currencyType
         */
        function updateCurrentType(currencyType) {
            $scope.currencies = Currencies.getCurrencies();

            // filter out crypto currencies that are not current
            $scope.currencies = $scope.currencies.filter(function (currency) {
                return currency.isFiat || currency.code === nativeCurrency;
            });

            // filter out selected currency
            $scope.currencies = $scope.currencies.filter(function (currency) {
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
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY),
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL),
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY),
                    activeWallet.getSdkWallet().maxSpendable($scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                ]).then(function (results) {
                    // set the local stored value
                    maxSpendable = {};
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY] = results[0];
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL] = results[1];
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY] = results[2];
                    maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE] = results[3];

                    maxSpendablePromise = null; // unset promise, it's done
                    return maxSpendable;
                });

                return maxSpendablePromise;
            }
        }

        /**
         * Get min spendable
         * @return {*}
         */
        function getMinSpendable(payParams) {
            for (var address in payParams) {
                if (payParams.hasOwnProperty(address)) {
                    payParams[address] = blocktrailSDK.DUST + 1;
                }
            }

            if (minSpendable !== null) {
                return $q.when(minSpendable);
            } else if (minSpendablePromise !== null) {
                return minSpendablePromise;
            } else {
                minSpendablePromise = $q.all([
                    _resolveFeeByPriority(payParams, blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY),
                    _resolveFeeByPriority(payParams, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL),
                    _resolveFeeByPriority(payParams, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY),
                    _resolveFeeByPriority(payParams, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                ]).then(function (results) {
                    // set the local stored value
                    minSpendable = {};
                    minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY] = results[0];
                    minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL] = results[1];
                    minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY] = results[2];
                    minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE] = results[3];

                    minSpendablePromise = null; // unset promise, it's done
                    return minSpendable;
                });

                return minSpendablePromise;
            }
        }

        /**
         * Fee resolver based on pay parameters, based on priority provided
         * @param payParams - Pay parameters for coinselection
         * @param priority - Fee strategy from blocktrailSDK.Wallet
         * @returns {*}
         * @private
         */
        function _resolveFeeByPriority(payParams, priority) {
            return activeWallet
                .getSdkWallet()
                .coinSelection(payParams, false, $scope.useZeroConf, priority)
                .spread(function (utxos, fee, change, res) {
                    return fee;
                })
        }

        /**
         * Applies fee result to scope
         * @param feeResult
         * @private
         */
        function _applyFeeResult(feeResult) {
            var lowPriorityFee = feeResult[0];
            var optimalFee = feeResult[1];
            var highPriorityFee = feeResult[2];
            var minRelayFee = feeResult[3];

            $scope.fees.lowPriority = lowPriorityFee;
            $scope.fees.optimal = optimalFee;
            $scope.fees.highPriority = highPriorityFee;
            $scope.fees.minRelayFee = minRelayFee;
            $scope.displayFee = true;

            return updateFee();
        }

        /**
         * Fetch fee
         */
        function fetchFee() {
            // reset state
            $scope.fees.highPriority = null;
            $scope.fees.optimal = null;
            $scope.fees.lowPriority = null;
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
                _resolveFeeByPriority(localPay, blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY),
                _resolveFeeByPriority(localPay, blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL),
                _resolveFeeByPriority(localPay, blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY),
                activeWallet
                    .getSdkWallet()
                    .coinSelection(localPay, false, $scope.useZeroConf, blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE)
                    .spread(function (utxos, fee, change, res) {
                        $log.debug("minRelayFee fee: " + fee);

                        $scope.prioboost.estSize = res.size;
                        $scope.prioboost.credits = res.prioboost_remaining;
                        $scope.prioboost.zeroConf = res.zeroconf;
                        $scope.prioboost.tooLarge = $scope.prioboost.estSize > $scope.PRIOBOOST_MAX_SIZE;
                        $scope.prioboost.possible = !$scope.prioboost.zeroConf && !$scope.prioboost.tooLarge && $scope.prioboost.credits > 0;

                        return fee;
                    })
            ])
                .catch(function (e) {
                    // when we get a fee error we use minspendable or maxspendable fee
                    if (
                        e instanceof blocktrail.WalletFeeError ||
                        e instanceof blocktrail.WalletSendError
                    ) {
                        return getMinSpendable(localPay)
                            .then(function (minSpendable) {
                                var lowPriorityFee = minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY];
                                var optimalFee = minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL];
                                var highPriorityFee = minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY];
                                var minRelayFee = minSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE];
                                $log.debug("minRelayFee fee MINSPENDABLE: " + minRelayFee);
                                _applyFeeResult([lowPriorityFee, optimalFee, highPriorityFee, minRelayFee]);
                                throw e;
                            });
                    } else if (
                        (e instanceof Error && e.message.indexOf("Wallet balance is too low") !== -1) ||
                        e.message === "Due to additional transaction fee it's not possible to send selected amount"
                    ) {
                        return getMaxSpendable()
                            .then(function (maxSpendable) {
                                var lowPriorityFee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_LOW_PRIORITY].fee;
                                var optimalFee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_OPTIMAL].fee;
                                var highPriorityFee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_HIGH_PRIORITY].fee;
                                var minRelayFee = maxSpendable[blocktrailSDK.Wallet.FEE_STRATEGY_MIN_RELAY_FEE].fee;
                                $log.debug("minRelayFee fee MAXSPENDABLE: " + minRelayFee);
                                _applyFeeResult([lowPriorityFee, optimalFee, highPriorityFee, minRelayFee])
                                throw e;
                            });
                    } else {
                        throw e;
                    }
                })
                .then(function (res) {
                    return _applyFeeResult(res);
                }, function (e) {
                    $log.debug("fetchFee ERR " + e);
                });
        }

        /**
         * Update fee
         */
        function updateFee() {
            if ($scope.sendInput.feeChoice === $scope.HIGH_PRIORITY_FEE) {
                $scope.fee = $scope.fees.optimal;
            } else if ($scope.sendInput.feeChoice === $scope.OPTIMAL_FEE) {
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
            // For BCH FORKING---
            if (walletData.networkType === 'BCC') {
                return false;
            }

            $scope.isLoading = true;

            return $scope
                .fetchFee()
                .then(validateData)
                .then(
                    function (sendAmount) {
                        $scope.isLoading = false;

                        $modal.open({
                            controller: "SendConfirmModalCtrl",
                            templateUrl: "js/modules/wallet/controllers/send-confirm-modal/send-confirm-modal.tpl.html",
                            size: "md",
                            backdrop: "static",
                            resolve: {
                                activeWallet: function () {
                                    return activeWallet;
                                },
                                sendData: function () {
                                    return {
                                        feeChoice: $scope.sendInput.feeChoice,
                                        recipientAddress: $scope.sendInput.recipientAddress,
                                        amount: sendAmount,
                                        requires2FA: $scope.requires2FA,
                                        paymentDetails: $scope.sendInput.paymentDetails
                                    };
                                }
                            }
                        });
                    },
                    function () {
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

            if ($scope.sendInput.amount * 1e8 <= blocktrailSDK.DUST) {
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
                    .then(function () {
                        return sendAmount;
                    })
                    .catch(function () {
                        $scope.errors.recipient = "MSG_INVALID_RECIPIENT";
                        return $q.reject();
                    });
            } else {
                return $q.reject();
            }
        }

        $scope.validateAddress = function () {
            if ($scope.sendInput.recipientAddress) {
                activeWallet.validateAddress($scope.sendInput.recipientAddress)
                    .catch(function (e) {
                        $scope.errors.recipient = "MSG_INVALID_RECIPIENT";
                    });
            }
        };

        /**
         * Clear recipient
         */
        $scope.clearRecipient = function () {
            $scope.sendInput = {
                recipientAddress: "",
                referenceMessage: "",
                pin: null,
                amount: "",
                feeChoice: $scope.OPTIMAL_FEE,
                // inputDisabled: false,//FOR BCH FORKING---
                inputDisabled: isInitialDisableSendInput(),//---FOR BCH FORKING
            };
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
