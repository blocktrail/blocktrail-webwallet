angular.module('blocktrail.wallet')
    .controller('BuyBTCChooseCtrl', function($q, $scope, $state, $rootScope, dialogService, settingsService,
                                             $translate, glideraService, buyBTCService, $log, $timeout) {
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

                settingsService.$isLoaded().then(function() {
                    settingsService.buyBTCRegion = _.defaults({}, $scope.chooseRegion);
                    return settingsService.$store();
                })
            });
        };

        $scope.goGlideraBrowser = function() {
            glideraService.userCanTransact().then(function(userCanTransact) {
                if (!userCanTransact) {
                    return glideraService.accessToken().then(function(accessToken) {
                        if (accessToken) {
                            return settingsService.$isLoaded().then(function() {
                                // 2: Additional user verification information is required
                                if (settingsService.glideraAccessToken.userCanTransactInfo.code == 2) {
                                    return $cordovaDialogs.confirm(
                                        $translate.instant('MSG_BUYBTC_SETUP_MORE_GLIDERA_BODY', {
                                            message: settingsService.glideraAccessToken.userCanTransactInfo.message
                                        }).sentenceCase(),
                                        $translate.instant('MSG_BUYBTC_SETUP_MORE_GLIDERA_TITLE').sentenceCase(),
                                        [$translate.instant('OK'), $translate.instant('CANCEL').sentenceCase()]
                                    )
                                        .then(function(dialogResult) {
                                            if (dialogResult == 2) {
                                                return;
                                            }

                                            return glideraService.setup();
                                        })
                                    ;

                                } else if (settingsService.glideraAccessToken.userCanTransactInfo) {
                                    throw new Error("User can't transact because: " + settingsService.glideraAccessToken.userCanTransactInfo.message);
                                } else {
                                    throw new Error("User can't transact for unknown reason!");
                                }
                            });

                        } else {
                            return dialogService.prompt({
                                body: $translate.instant('MSG_BUYBTC_SETUP_GLIDERA_BODY').sentenceCase(),
                                title: $translate.instant('MSG_BUYBTC_SETUP_GLIDERA_TITLE').sentenceCase(),
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
                    alert(err);
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
    .controller('BuyBTCBuyCtrl', function($scope, $state, $rootScope, dialogService, glideraService, buyBTCService,
                                          $stateParams, $log, $timeout, $interval, $translate, $filter) {
        $scope.broker = $stateParams.broker;

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
        $scope.currencies = null;
        $scope.altCurrency = {};

        var updateMainPrice = function() {
            $scope.fetchingMainPrice = true;

            return glideraService.buyPrices(1.0).then(function(result) {
                $timeout(function() {
                    $scope.priceBTC = result.total;

                    $scope.fetchingMainPrice = false;
                });
            });
        };

        $scope.updateInputPrice = function() {
            $timeout(function() {
                $scope.fetchingInputPrice = true;

                if ($scope.buyInput.currencyType === 'BTC') {
                    $scope.buyInput.btcValue = parseFloat($scope.buyInput.amount || 0) || 0;
                    $scope.buyInput.fiatValue = null;
                    $scope.buyInput.feeValue = null;
                    $scope.altCurrency = {};

                    if (!$scope.buyInput.amount || !$scope.buyInput.btcValue) {
                        return;
                    }

                    return glideraService.buyPrices($scope.buyInput.btcValue, null).then(function(result) {
                        $timeout(function() {
                            $scope.buyInput.fiatValue = parseFloat(result.total);
                            $scope.buyInput.feeValue = parseFloat(result.fees);
                            $scope.buyInput.feePercentage = ($scope.buyInput.feeValue / $scope.buyInput.fiatValue) * 100;

                            $scope.altCurrency = {
                                code: $scope.buyInput.fiatCurrency,
                                amount: $scope.buyInput.fiatValue
                            };

                            $scope.fetchingInputPrice = false;
                        });
                    });
                } else {
                    $scope.buyInput.fiatValue = parseFloat($scope.buyInput.amount || 0) || 0;
                    $scope.buyInput.btcValue = null;
                    $scope.buyInput.feeValue = null;
                    $scope.altCurrency = {};

                    if (!$scope.buyInput.amount || !$scope.buyInput.fiatValue) {
                        return;
                    }

                    return glideraService.buyPrices(null, $scope.buyInput.fiatValue).then(function(result) {
                        $timeout(function() {
                            $scope.buyInput.btcValue = parseFloat(result.qty);
                            $scope.buyInput.feeValue = parseFloat(result.fees);
                            $scope.buyInput.feePercentage = ($scope.buyInput.feeValue / $scope.buyInput.fiatValue) * 100;

                            $scope.altCurrency = {
                                code: 'BTC',
                                amount: $scope.buyInput.btcValue
                            };

                            $scope.fetchingInputPrice = false;
                        });
                    });
                }
            });
        };
        $scope.updateCurrentType = function(currencyType) {
            $scope.currencies = [{code: 'USD', symbol: 'USD'}];
            $scope.currencies.unshift({code: 'BTC', 'symbol': 'BTC'});
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code != currencyType;
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

            if ($scope.broker == 'glidera') {
                var btcValue = null, fiatValue = null;
                if ($scope.fiatFirst) {
                    fiatValue = $scope.buyInput.fiatValue;
                } else {
                    btcValue = $scope.buyInput.btcValue;
                }

                return glideraService.buyPricesUuid(btcValue, fiatValue)
                    .then(function(result) {
                        return dialogService.prompt({
                            body: $translate.instant('MSG_BUYBTC_CONFIRM_BODY', {
                                qty: $filter('number')(result.qty, 6),
                                price: $filter('number')(result.total, 2),
                                fee: $filter('number')(result.fees, 2),
                                currencySymbol: $filter('toCurrencySymbol')('USD')
                            }).sentenceCase(),
                            title: $translate.instant('MSG_BUYBTC_CONFIRM_TITLE').sentenceCase(),
                            prompt: false
                        })
                            .result
                            .then(function() {
                                spinner = dialogService.spinner({title: 'BUYBTC_BUYING'});

                                return glideraService.buy(result.qty, result.priceUuid)
                                    .then(function() {
                                        spinner.close();

                                        dialogService.alert({
                                            body: $translate.instant('MSG_BUYBTC_BOUGHT_BODY', {
                                                qty: $filter('number')(result.qty, 6),
                                                price: $filter('number')(result.total, 2),
                                                fee: $filter('number')(result.fees, 2),
                                                currencySymbol: $filter('toCurrencySymbol')('USD')
                                            }).sentenceCase(),
                                            title: $translate.instant('MSG_BUYBTC_BOUGHT_TITLE').sentenceCase()
                                        });

                                        $state.go('app.wallet.summary');
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
                    })
                ;
            } else {
                alert("Unknown broker");
            }
        };
    })
;
