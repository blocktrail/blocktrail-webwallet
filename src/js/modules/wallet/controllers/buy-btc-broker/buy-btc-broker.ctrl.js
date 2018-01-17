(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("BuyBTCBrokerCtrl", BuyBTCBrokerCtrl);

    // TODO Needs refactoring
    function BuyBTCBrokerCtrl($scope, $state, dialogService, glideraService, simplexService, activeWallet, settingsService, CONFIG,
                              $stateParams, $q, $timeout, $interval, $translate, $filter, trackingService, NotificationsService) {
        var walletData = activeWallet.getReadOnlyWalletData();

        $scope.broker = $stateParams.broker;
        $scope.brokerNotExistent = false;

        $scope.initializing = true;
        $scope.fetchingMainPrice = true;
        $scope.priceBTC = null;
        $scope.fetchingInputPrice = false;
        $scope.fiatFirst = false;
        $scope.buyInput = {
            currencyType: null,
            fiatCurrency: "USD",
            amount: null,
            btcValue: null,
            fiatValue: null,
            feeValue: null,
            feePercentage: null
        };
        $scope.currencies = [];
        $scope.altCurrency = {};

        $scope.termsAccepted = false;
        $scope.includingFee = true;

        $scope.errorMsg = null;
        var last_simplex_data = null;
        // Check if the user returned within seconds
        NotificationsService.checkAndPromptSimplex();

        var doneTypingInterval = 500;
        var typingTimer = null;

        var coinTicker = CONFIG.NETWORKS[walletData.networkType].TICKER;

        var fetchBrokerService = function() {
            switch ($scope.broker) {
                case "glidera":
                    $scope.includingFee = true;
                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_OPEN);
                    $scope.buyInput.currencyType = "USD";
                    $scope.buyInput.fiatCurrency = "USD";
                    return glideraService;
                    break;
                case 'simplex':
                    $scope.includingFee = false;

                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.SIMPLEX_OPEN);
                    return simplexService;
                    break;
                default:
                    return null;
                    break;
            }
        };

        var handleErrors = function (errorMessage) {
            if (errorMessage.indexOf('value over limit') != -1) {
                $scope.errorMsg = $translate.instant("BUYBTC_HIGH_AMOUNT_ERROR", {
                    limit: 'US$' + errorMessage.replace(/[^0-9]/g, '')
                });
            } else if (errorMessage.indexOf('value under limit') != -1) {
                $scope.errorMsg = $translate.instant("BUYBTC_LOW_AMOUNT_ERROR", {
                    limit: 'US$' + errorMessage.replace(/[^0-9]/g, '')
                });
            } else {
                $scope.errorMsg = $translate.instant("BUYBTC_ERROR", {
                    network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG
                });
            }
        };

        var updateBrokerCurrencies = function() {
            switch ($scope.broker) {
                case "glidera":
                    $scope.currencies = [{code: "USD", symbol: "USD"}];
                    return true;
                    break;
                case "simplex":
                    $scope.currencies = [
                        {code: "USD", symbol: "USD"},
                        {code: "EUR", symbol: "EUR"}
                    ];
                    return true;
                    break;
                default:
                    return false;
                    break;
            }
        };

        var updateMainPrice = function() {
            $scope.fetchingMainPrice = true;

            if (fetchBrokerService() == null) {
                $scope.brokerNotExistent = true;
                $scope.initializing = false;
                $scope.fetchingMainPrice = false;
                return null;
            }

            return fetchBrokerService().buyPrices(1, null, $scope.buyInput.fiatCurrency, false).then(function(result) {
                $scope.priceBTC = result.total;
                $scope.fetchingMainPrice = false;
            }).catch(function (e) {
                handleErrors(e.message);
            });
        };

        $scope.triggerUpdate = function() {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(function() {
                $scope.updateInputPrice().catch(function() {
                    $scope.fetchingInputPrice = false;
                });
            }, doneTypingInterval);
        };

        $scope.updateInputPrice = function() {
            return $q.when().then(function() {
                $scope.fetchingInputPrice = true;
                $scope.errorMsg = null; // reset last error

                if ($scope.buyInput.currencyType === coinTicker) {
                    $scope.fiatFirst = false;
                    $scope.buyInput.btcValue = parseFloat($scope.buyInput.amount || 0) || 0;
                    $scope.buyInput.fiatValue = null;
                    $scope.buyInput.feeValue = null;
                    $scope.altCurrency = {};

                    if (!$scope.buyInput.amount || !$scope.buyInput.btcValue) {
                        return;
                    }

                    return fetchBrokerService().buyPrices($scope.buyInput.btcValue, null, $scope.buyInput.fiatCurrency, false)
                        .then(function(result) {
                            $timeout(function() {
                                $scope.buyInput.fiatValue = parseFloat(result.total);
                                if (isNaN($scope.buyInput.fiatValue)) {
                                    $scope.buyInput.fiatValue = null;
                                }
                                if (result.fees) $scope.buyInput.feeValue = parseFloat(result.fees);
                                if (result.fees) $scope.buyInput.feePercentage = ($scope.buyInput.feeValue / $scope.buyInput.fiatValue) * 100;

                                $scope.altCurrency = {
                                    code: $scope.buyInput.fiatCurrency,
                                    amount: $scope.buyInput.fiatValue
                                };

                                if ($scope.broker === 'simplex') {
                                    last_simplex_data = result;
                                }

                                $scope.fetchingInputPrice = false;

                                // simplex error handling
                                if (result["error"]) {
                                    // if it is not JSON
                                    try { JSON.parse(data); }
                                    catch(e) {
                                        $scope.errorMsg = result["error"];
                                    }
                                }
                            });
                    });
                } else {
                    $scope.fiatFirst = true;
                    $scope.buyInput.fiatValue = parseFloat($scope.buyInput.amount || 0) || 0;
                    $scope.buyInput.btcValue = null;
                    $scope.buyInput.feeValue = null;
                    $scope.altCurrency = {};

                    if (!$scope.buyInput.amount || !$scope.buyInput.fiatValue) {
                        return;
                    }

                    return fetchBrokerService().buyPrices(null, $scope.buyInput.fiatValue, $scope.buyInput.fiatCurrency, $scope.fiatFirst)
                        .then(function(result) {
                            $timeout(function() {
                                $scope.buyInput.btcValue = parseFloat(result.qty);
                                if (isNaN($scope.buyInput.btcValue)) {
                                    $scope.buyInput.btcValue = null;
                                }
                                if (result.fees) $scope.buyInput.feeValue = parseFloat(result.fees);
                                if (result.fees) $scope.buyInput.feePercentage = ($scope.buyInput.feeValue / $scope.buyInput.fiatValue) * 100;

                                $scope.altCurrency = {
                                    code: coinTicker,
                                    amount: $scope.buyInput.btcValue
                                };

                                if ($scope.broker === 'simplex') {
                                    last_simplex_data = result;
                                }

                                $scope.fetchingInputPrice = false;

                                // simplex error handling
                                if (result["error"]) {
                                    // if it is not JSON
                                    try { JSON.parse(data); }
                                    catch(e) {
                                        $scope.errorMsg = result["error"];
                                    }
                                }
                            });
                    });
                }// else
            }).catch(function (e) {
                handleErrors(e.message);
            });
        };

        $scope.updateCurrentType = function(currencyType) {
            updateBrokerCurrencies();
            $scope.currencies.unshift({code: coinTicker, "symbol": coinTicker});
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            if (currencyType === coinTicker) {
                if ($scope.buyInput.fiatCurrency === $scope.buyInput.currencyType) {
                    $scope.buyInput.amount = $scope.buyInput.btcValue;
                } else {
                    $scope.buyInput.amount = null;
                }
            } else {
                if ($scope.buyInput.fiatCurrency === currencyType) {
                    $scope.buyInput.amount = $scope.buyInput.fiatValue;
                } else {
                    $scope.buyInput.amount = null;
                    $scope.buyInput.fiatCurrency = currencyType;
                }
            }

            // Update simplex price after currency change
            if($scope.broker === 'simplex') {
                updateMainPrice();
            }

            $scope.buyInput.currencyType = currencyType;
            $scope.updateInputPrice();
        };

        // set default BTC or BCH
        $scope.updateCurrentType(coinTicker);

        /*
         * init buy getting an access token, repeat until we have an access token
         *  then update main price and set interval for updating price
         */
        var pollInterval;
        var init = function() {

            if ($scope.broker) {
                $scope.initializing = false;
            }

            // update main price for display straight away
            updateMainPrice().then(function() {
                $timeout(function() {
                    $scope.initializing = false;
                });
            });

            // update every minute
            pollInterval = $interval(function() {
                // update main price
                updateMainPrice();
                // update input price
                $scope.updateInputPrice();
            }, 60 * 1000);
        };

        $scope.$on("$destroy", function() {
            if (pollInterval) {
                $interval.cancel(pollInterval);
            }
        });

        $timeout(function() {
            init();
        });

        $scope.buyBTC = function() {
            var spinner;

            var btcValue = $scope.buyInput.btcValue;
            var fiatValue = $scope.buyInput.fiatValue;

            if (fiatValue + btcValue <= 0) {
                return dialogService.prompt({
                    body: $translate.instant("MSG_BUYBTC_ZERO_AMOUNT"),
                    title: $translate.instant("MSG_BUYBTC_CONFIRM_TITLE", {network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG}),
                    prompt: false
                }).result;
            }

            switch ($scope.broker) {
                case "glidera":
                    return glideraService.buyPricesUuid(btcValue, fiatValue)
                        .then(function(result) {
                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_BUY_CONFIRM);
                            return dialogService.prompt({
                                body: $translate.instant("MSG_BUYBTC_CONFIRM_BODY", {
                                    qty: $filter("number")(result.qty, 6),
                                    price: $filter("number")(result.total, 2),
                                    fee: $filter("number")(result.fees, 2),
                                    currencySymbol: $filter("toCurrencySymbol")($scope.buyInput.fiatCurrency)
                                }),
                                title: $translate.instant("MSG_BUYBTC_CONFIRM_TITLE"),
                                prompt: false
                            })
                                .result
                                .then(function() {
                                    spinner = dialogService.spinner({
                                        title: $translate.instant('BUYBTC_BUYING', {network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG})
                                    });

                                    return glideraService.buy(result.qty, result.priceUuid)
                                        .then(function() {
                                            spinner.close();

                                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_BUY_DONE);

                                            dialogService.alert({
                                                body: $translate.instant("MSG_BUYBTC_BOUGHT_BODY", {
                                                    qty: $filter("number")(result.qty, 6),
                                                    price: $filter("number")(result.total, 2),
                                                    fee: $filter("number")(result.fees, 2),
                                                    currencySymbol: $filter("toCurrencySymbol")("USD")
                                                }),
                                                title: $translate.instant("MSG_BUYBTC_BOUGHT_TITLE")
                                            });

                                            $state.go("app.wallet.summary");
                                        }, function(e) {
                                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_BUY_ERR);
                                            throw e;
                                        })
                                        ;
                                });
                        })
                        .then(function() {
                            // -
                        }, function(err) {
                            if (spinner) {
                                spinner.close();
                            }

                            if (err != "CANCELLED" && err != "dismiss") {
                                dialogService.alert({
                                    title: "ERROR_TITLE_1",
                                    body: "" + err
                                });
                            }
                        });
                    break;
                case 'simplex':
                    spinner = dialogService.spinner({
                        title: $translate.instant('BUYBTC_BUYING', {network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG})
                    });

                    // Generate local simplex data object
                    var simplexData = {};
                    // Make a snapshot of the current simplex data
                    simplexData = angular.copy(last_simplex_data);
                    // Set payment id and identifier
                    simplexData.payment_id = simplexService.generateUUID();
                    simplexData.identifier = walletData.identifier;

                    return activeWallet.getNewAddress().then(function (address) {
                        // Set address and generate an order id
                        simplexData.address = address;
                        simplexData.order_id = simplexService.generateUUID();

                        return simplexService.issuePaymentRequest(simplexData).then(function (response) {
                            return dialogService.alert({
                                title: $translate.instant('BUYBTC_BUYING', { network: CONFIG.NETWORKS[walletData.networkType].NETWORK_LONG}),
                                body: $translate.instant('MSG_SIMPLEX_REDIRECT', {'orderId' : simplexData.order_id}),
                                ok: $translate.instant('OK'),
                                cancel: $translate.instant('CANCEL')
                            })
                                .result
                                .then(function (dialogResult) {
                                    if (dialogResult === 2) {
                                        spinner.close();
                                        return true;
                                    }

                                    // Remember the time when the user went to simplex
                                    settingsService.updateSettingsUp({
                                        'simplexLastForward': ((new Date()).getTime() / 1000).toFixed(0)
                                    })
                                        .then(simplexService.initRedirect(simplexData))
                                        .then(function () {
                                            spinner.close();
                                        });
                                }).catch(function (e) {
                                    spinner.close();
                                });
                        })
                    }).catch(function (e) {
                        spinner.close();
                        handleErrors(e.message);
                    });
                    break;
            }
        };

        $scope.$watch("broker", function() {
            fetchBrokerService();
        });
    }
})();
