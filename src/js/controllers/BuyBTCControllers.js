angular.module('blocktrail.wallet')
    .controller('BuyBTCChooseCtrl', function($q, $scope, $state, $rootScope, dialogService, settingsService,
                                             $translate, glideraService, buyBTCService, $log, $timeout, trackingService) {
        $scope.brokers = [];

        // load chooseRegion from settingsService
        $scope.chooseRegion = null;
        settingsService.$isLoaded().then(function() {
            $q.all([,
                buyBTCService.regions().then(function(regions) {
                    $scope.regions = regions;
                }),
                buyBTCService.usStates().then(function(usStates) {
                    $scope.usStates = usStates;
                })
            ]).then(function() {
                $scope.chooseRegion = _.defaults({}, settingsService.buyBTCRegion, {
                    code: null,
                    name: null
                });

                return buyBTCService.regionBrokers($scope.chooseRegion.code).then(function(brokers) {
                    $scope.brokers = brokers;
                    $scope.chooseRegion.regionOk = $scope.brokers.length;
                });
            });
        });

        $scope.selectRegion = function(region, name) {
            $log.debug('selectRegion: ' + region + ' (' + name + ')');
            $scope.chooseRegion.code = region;
            $scope.chooseRegion.name = name;

            buyBTCService.regionBrokers($scope.chooseRegion.code).then(function(brokers) {
                $scope.brokers = brokers;
                $scope.chooseRegion.regionOk = $scope.brokers.length;

                if ($scope.chooseRegion.regionOk) {
                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.REGION_OK);
                } else {
                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.REGION_NOTOK);
                }

                settingsService.$isLoaded().then(function() {
                    settingsService.buyBTCRegion = _.defaults({}, $scope.chooseRegion);
                    return settingsService.$store().then(function() {
                        return settingsService.$syncSettingsUp();
                    });
                })
            });
        };

        $scope.goBuyBTCState = function (broker) {
            $state.go('app.wallet.buybtc.buy', {broker: broker});
        };

        $scope.goGlideraBrowser = function() {
            glideraService.userCanTransact().then(function(userCanTransact) {
                if (!userCanTransact) {
                    return glideraService.accessToken().then(function(accessToken) {
                        if (accessToken) {
                            return settingsService.$isLoaded().then(function() {
                                // 2: Additional user verification information is required
                                if (settingsService.glideraAccessToken.userCanTransactInfo.code == 2) {
                                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_SETUP_UPDATE);
                                    return dialogService.prompt({
                                        body: $translate.instant('MSG_BUYBTC_SETUP_MORE_GLIDERA_BODY', {
                                            message: settingsService.glideraAccessToken.userCanTransactInfo.message
                                        }),
                                        title: $translate.instant('MSG_BUYBTC_SETUP_MORE_GLIDERA_TITLE'),
                                        prompt: false
                                    })
                                        .result
                                        .then(function() {
                                            return glideraService.setup();
                                        }, function() {
                                            // -
                                        });

                                } else if (settingsService.glideraAccessToken.userCanTransactInfo) {
                                    throw new Error("User can't transact because: " + settingsService.glideraAccessToken.userCanTransactInfo.message);
                                } else {
                                    throw new Error("User can't transact for unknown reason!");
                                }
                            });

                        } else {
                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_SETUP_INIT);
                            return dialogService.prompt({
                                body: $translate.instant('MSG_BUYBTC_SETUP_GLIDERA_BODY'),
                                title: $translate.instant('MSG_BUYBTC_SETUP_GLIDERA_TITLE'),
                                prompt: false
                            })
                                .result
                                .then(function() {
                                    return glideraService.oauth2();
                                }, function() {
                                    // -
                                })
                            ;
                        }
                    });
                } else {
                    $state.go('app.wallet.buybtc.buy', {broker: 'glidera'});
                }
            })
                .then(function() {
                    // -
                }, function(err) {
                    if (!dialogService.isCancel(err)) {
                        alert(err);
                    }
                })
            ;
        };

        /**
         * reset buy BTC state for debugging purposes
         */
        $scope.resetBuyBTC = function() {
            return settingsService.$isLoaded().then(function() {
                settingsService.glideraAccessToken = null;
                settingsService.buyBTCRegion = null;

                return settingsService.$store().then(function() {
                    return settingsService.$syncSettingsUp();
                })
            })
                .then(function() {
                    $state.go('app.wallet.summary');
                }, function(err) {
                    alert(err);
                })
            ;
        };
    })
;

angular.module('blocktrail.wallet')
    .controller('BuyBTCChooseRegionCtrl', function($q, $scope, $log) {
        $scope.usSelected = false;

        $scope.selectUS = function() {
            $scope.usSelected = true;
        };
    })
;

angular.module('blocktrail.wallet')
    .controller('BuyBTCGlideraOauthCallbackCtrl', function($scope, $state, $rootScope, glideraService) {

        glideraService.handleOauthCallback(window.location.href)
            .then(function() {
                return glideraService.userCanTransact().then(function(userCanTransact) {
                    if (userCanTransact) {
                        $state.go('app.wallet.buybtc.buy', {broker: 'glidera'});
                    } else {
                        $state.go('app.wallet.buybtc.choose');
                    }
                })
            }, function(err) {
                console.error("" + err);
                $state.go('app.wallet.buybtc.choose');
            })
        ;
    })
;

angular.module('blocktrail.wallet')
    .controller('BuyBTCBrokerCtrl', function($scope, $state, $rootScope, dialogService, glideraService, bitonicService, buyBTCService,
                                          $stateParams, $log, $timeout, $interval, $translate, $filter, trackingService) {

        $scope.broker = $stateParams.broker;
        $scope.brokerNotExistent = false;

        $scope.initializing = true;
        $scope.fetchingMainPrice = true;
        $scope.priceBTC = null;
        $scope.fetchingInputPrice = false;
        $scope.fiatFirst = false;
        $scope.buyInput = {
            currencyType: null,
            fiatCurrency: 'USD',
            amount: null,
            btcValue: null,
            fiatValue: null,
            feeValue: null,
            feePercentage: null
        };
        $scope.currencies = [];
        $scope.altCurrency = {};

        var doneTypingInterval = 200;
        var typingTimer = null;
        
        var lastPriceResponse = null;

        switch ($scope.broker) {
            case 'glidera':
                trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_OPEN);
                $scope.buyInput.currencyType = 'USD';
                $scope.buyInput.fiatCurrency = 'USD';
                break;
            case 'bitonic':
                trackingService.trackEvent(trackingService.EVENTS.BUYBTC.BITONIC_OPEN);
                $scope.buyInput.currencyType = 'EUR';
                $scope.buyInput.fiatCurrency = 'EUR';
                break;
            default:
                return null;
                break;
        }

        var fetchBrokerService = function () {
            switch ($scope.broker) {
                case 'glidera':
                    return glideraService;
                    break;
                case 'bitonic':
                    return bitonicService;
                    break;
                default:
                    return null;
                    break;
            }
        };

        var updateBrokerCurrencies = function () {
            switch ($scope.broker) {
                case 'glidera':
                    $scope.currencies = [{code: 'USD', symbol: 'USD'}];
                    return true;
                    break;
                case 'bitonic':
                    $scope.currencies = [{code: 'EUR', symbol: 'EUR'}];
                    return true;
                    break;
                default:
                    return false;
                    break;
            }
        };

        var evaluateResponseErrors = function(result) {
            // These are Bitonic-specific - 'success' key in result object
            if ("success" in result) {
                if (!result.success && result.error.indexOf('Invalid value') !== -1) {
                    return dialogService.prompt({
                        body: $translate.instant('MSG_BUYBTC_ERROR_INVALID_AMOUNT'),
                        title: $translate.instant('MSG_INVALID_AMOUNT'),
                        prompt: false
                    });
                }else if (!result.success) {
                    return dialogService.prompt({
                        body: $translate.instant('MSG_BUYBTC_ERROR_TRY_AGAIN_LATER'),
                        title: $translate.instant('ERROR_TITLE_3'),
                        prompt: false
                    });
                }
            }
        };

        var updateMainPrice = function() {
            $scope.fetchingMainPrice = true;

            if(fetchBrokerService() == null) {
                $scope.brokerNotExistent = true;
                $scope.initializing = false;
                $scope.fetchingMainPrice = false;
                return null;
            }

            return fetchBrokerService().buyPrices(1, null).then(function (result) {
                $scope.priceBTC = result.total;
                $scope.fetchingMainPrice = false;
            });
        };

        $scope.triggerUpdate = function() {
            clearTimeout (typingTimer);
            typingTimer = setTimeout(function () {
                $scope.updateInputPrice().catch(function () {
                    $scope.fetchingInputPrice = false;
                });
            }, doneTypingInterval);
        };

        $scope.updateInputPrice = function() {
            $timeout(function() {
                $scope.fetchingInputPrice = true;

                if ($scope.buyInput.currencyType === 'BTC') {
                    $scope.fiatFirst = false;
                    $scope.buyInput.btcValue = parseFloat($scope.buyInput.amount || 0) || 0;
                    $scope.buyInput.fiatValue = null;
                    $scope.buyInput.feeValue = null;
                    $scope.altCurrency = {};

                    if (!$scope.buyInput.amount || !$scope.buyInput.btcValue) {
                        return;
                    }

                    return fetchBrokerService().buyPrices($scope.buyInput.btcValue, null).then(function(result) {
                        $timeout(function() {
                            lastPriceResponse = result;

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

                            $scope.fetchingInputPrice = false;
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

                    return fetchBrokerService().buyPrices(null, $scope.buyInput.fiatValue).then(function(result) {
                        $timeout(function() {
                            lastPriceResponse = result;

                            $scope.buyInput.btcValue = parseFloat(result.qty);
                            if (isNaN($scope.buyInput.btcValue)) {
                                $scope.buyInput.btcValue = null;
                            }
                            if (result.fees) $scope.buyInput.feeValue = parseFloat(result.fees);
                            if (result.fees) $scope.buyInput.feePercentage = ($scope.buyInput.feeValue / $scope.buyInput.fiatValue) * 100;

                            $scope.altCurrency = {
                                code: 'BTC',
                                amount: $scope.buyInput.btcValue
                            };

                            $scope.fetchingInputPrice = false;
                        });
                    });
                }// else
            });
        };

        $scope.updateCurrentType = function(currencyType) {
            updateBrokerCurrencies();
            $scope.currencies.unshift({code: 'BTC', 'symbol': 'BTC'});
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            if (currencyType === 'BTC') {
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

            $scope.buyInput.currencyType = currencyType;
            $scope.updateInputPrice();
        };

        // set default BTC
        $scope.updateCurrentType('BTC');

        /*
         * init buy getting an access token, repeat until we have an access token
         *  then update main price and set interval for updating price
         */
        var pollInterval;
        var init = function() {
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

        $scope.$on('$destroy', function() {
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

            if (lastPriceResponse.error) {
                return evaluateResponseErrors(lastPriceResponse);
            }

            if(fiatValue + btcValue <= 0) {
                return dialogService.prompt({
                    body: $translate.instant('MSG_BUYBTC_ZERO_AMOUNT'),
                    title: $translate.instant('MSG_BUYBTC_CONFIRM_TITLE'),
                    prompt: false
                }).result;
            }

            switch ($scope.broker) {
                case 'glidera':

                    return glideraService.buyPricesUuid(btcValue, fiatValue)
                        .then(function(result) {
                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_BUY_CONFIRM);
                            return dialogService.prompt({
                                body: $translate.instant('MSG_BUYBTC_CONFIRM_BODY', {
                                    qty: $filter('number')(result.qty, 6),
                                    price: $filter('number')(result.total, 2),
                                    fee: $filter('number')(result.fees, 2),
                                    currencySymbol: $filter('toCurrencySymbol')($scope.buyInput.fiatCurrency)
                                }),
                                title: $translate.instant('MSG_BUYBTC_CONFIRM_TITLE'),
                                prompt: false
                            })
                                .result
                                .then(function() {
                                    spinner = dialogService.spinner({title: 'BUYBTC_BUYING'});

                                    return glideraService.buy(result.qty, result.priceUuid)
                                        .then(function() {
                                            spinner.close();

                                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_BUY_DONE);

                                            dialogService.alert({
                                                body: $translate.instant('MSG_BUYBTC_BOUGHT_BODY', {
                                                    qty: $filter('number')(result.qty, 6),
                                                    price: $filter('number')(result.total, 2),
                                                    fee: $filter('number')(result.fees, 2),
                                                    currencySymbol: $filter('toCurrencySymbol')('USD')
                                                }),
                                                title: $translate.instant('MSG_BUYBTC_BOUGHT_TITLE')
                                            });

                                            $state.go('app.wallet.summary');
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
                                    title: 'ERROR_TITLE_1',
                                    body: "" + err
                                });
                            }
                        });
                    break;
                case 'bitonic':
                    return bitonicService.buyPrices(btcValue, fiatValue).then(function (result) {
                        return dialogService.prompt({
                            body: $translate.instant('MSG_BUYBTC_CONFIRM_BODY', {
                                qty: $filter('number')(result.qty, 6),
                                price: $filter('number')(result.total, 2),
                                fee: $filter('number')(result.fees, 2),
                                currencySymbol: $filter('toCurrencySymbol')($scope.buyInput.fiatCurrency)
                            }),
                            title: $translate.instant('MSG_BUYBTC_CONFIRM_TITLE'),
                            prompt: false
                        }).result.then(function() {
                            if($scope.fiatFirst) {
                                console.log('fiat first');
                                bitonicService.buy(null, result.total);
                            } else {
                                bitonicService.buy(result.qty, null);
                            }
                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.BITONIC_BUY_CONFIRM);
                        });
                    });
                    break;
            }// switch
        };

        $scope.$watch('broker', function () {
            fetchBrokerService();
        })
    })
;
