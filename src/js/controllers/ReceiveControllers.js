angular.module('blocktrail.wallet')
    .controller('ReceiveCtrl', function($scope, $rootScope, CONFIG, activeWallet, settingsService, CurrencyConverter,
                                        Currencies, $q, $timeout, $translate, trackingService) {
        $scope.settings = settingsService.getReadOnlySettings();

        $rootScope.pageTitle = 'RECEIVE';

        $scope.address      = null;
        $scope.path         = null;
        $scope.bitcoinUri   = null;
        $scope.qrcode       = null;
        $scope.newRequest   = {
            address: null,
            path: null,
            btcValue: 0,
            fiatValue: 0,
            message: null,
            bitcoinUri: ""
        };

        $scope.qrSettings   = {
            correctionLevel: 7,
            SIZE: 225,
            inputMode: 'M',
            image: true
        };

        $scope.swapInputs = function() {
            $scope.fiatFirst = !$scope.fiatFirst;
        };

        $scope.currencies   = null;
        $scope.currencyType = null;
        $scope.altCurrency  = {};

        $scope.$on('enabled_currency', function() {
            $scope.updateCurrentType($scope.currencyType);
        });

        $scope.updateCurrentType = function(currencyType) {
            $scope.currencies = Currencies.getFiatCurrencies();
            $scope.currencies.unshift({code: 'BTC', 'symbol': CONFIG.TICKER});
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            $scope.currencyType = currencyType;

            $scope.setAltCurrency();

        };

        $scope.setAltCurrency = function() {
             if ($scope.currencyType === 'BTC') {
                $scope.altCurrency.code     = $scope.settings.localCurrency;
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.fromBTC($scope.newRequest.btcValue, $scope.settings.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code     = 'BTC';
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.toBTC($scope.newRequest.btcValue, $scope.currencyType, 6)) || 0;
            }

            if ($scope.altCurrency.amount > 0) {
                trackingService.trackEvent(trackingService.EVENTS.RECEIVE_CUSTOM_AMOUNT);
            }
        };

        // set default BTC
        $scope.updateCurrentType('BTC');

        $scope.newAddress = function() {
            $scope.newRequest.address = null;
            $q.when(activeWallet.getNewAddress()).then(function(address) {
                $scope.newRequest.address = address;
            }).catch(function(e) {
                console.log(e);
            });
        };

        $scope.generateQR = function() {
            if (!$scope.newRequest.address) {
                return false;
            }

            $scope.newRequest.bitcoinUri = "bitcoin:" + $scope.newRequest.address;
            $scope.newRequest.qrValue = 0;
            if ($scope.currencyType === 'BTC') {
                $scope.newRequest.qrValue = parseFloat($scope.newRequest.btcValue);
            } else {
                $scope.newRequest.qrValue = parseFloat($scope.altCurrency.amount);
            }

            if (!isNaN($scope.newRequest.qrValue) && $scope.newRequest.qrValue.toFixed(8) !== '0.00000000') {
                $scope.newRequest.bitcoinUri += "?amount=" + $scope.newRequest.qrValue.toFixed(8);
            }
        };

        //update the URI and QR code when address or value change
        $scope.$watchGroup(['newRequest.btcValue', 'newRequest.address', 'currencyType'], function(newValues, oldValues) {
            if (oldValues !== newValues) {
                //ignore call from scope initialisation
                $scope.generateQR();
            }
        });

        //generate the first address
        $scope.newAddress();
    })

    .controller('AddressLookupCtrl', function($scope, $rootScope, dialogService, $translate, activeWallet, $q, CONFIG, $cacheFactory, $timeout, $log) {
        $rootScope.pageTitle = 'ADDRESS_LOOKUP';

        var $cache = $cacheFactory.get('address-lookup') || $cacheFactory('address-lookup', {capacity: 10});

        $scope.items = [];
        $scope.totalItems = null;
        $scope.itemsPerPage = 15;
        $scope.currentPage = 1;

        // Search related
        $scope.searchText = "";
        $scope.isLoading = false;
        $scope.checkOnlyUsed = false;
        $scope.checkOnlyLabeled = false;
        $scope.searchSortOrder = 'asc';

        $scope.alert = dialogService.alertSingleton();

        $scope.$on("$destroy", function(){
            $log.log("Address cache cleared on leaving lookup state");
            $cache.removeAll();
        });

        $scope.addLabel = function(addrNumber) {
            return dialogService.prompt({
                title: $translate.instant('EDIT_LABEL'),
                body: $translate.instant('ENTER_NEW_LABEL'),
                input_type: 'text',
                icon: ''
            }).result.then(function(data) {
                if(data.length > 100) {
                    $scope.alert({
                        title: $translate.instant('EDIT_LABEL'),
                        body: $translate.instant('LABEL_MAX_LENGTH_INFO'),
                        ok: $translate.instant('OK')
                    });
                } else {
                    return activeWallet._sdkWallet.labelAddress($scope.items[addrNumber].address, data).then(function () {
                        $scope.items[addrNumber].label = data;
                        $cache.removeAll(); // flush cache
                    }).catch(function(err) {
                        $log.log("Labeling address failed", err);
                    });
                }
            });
        };

        $scope.removeLabel = function(addrNumber) {
            return dialogService.alert({
                title: $translate.instant('DELETE_LABEL'),
                body: $translate.instant('CONFIRM_DELETE_LABEL_QUESTION'),
                ok: $translate.instant('OK'),
                cancel: $translate.instant('CANCEL')
            }).result.then(function() {
                return activeWallet._sdkWallet.labelAddress($scope.items[addrNumber].address, "").then(function (res) {
                    $scope.items[addrNumber].label = "";
                    $cache.removeAll(); // flush cache
                });
            });
        };

        /**
         * Filters addresses (uses pagination, max 20 res per request) by a search text, usage and labels.
         * @param page Page of search results
         * @param limit Limit of results per page (max 20)
         * @param sort_dir Sort order ('asc' or 'desc')
         * @param searchText Search for this text (in addresses and labels)
         * @param hideUnused Hide unused addresses
         * @param hideUnlabeled Hide unlabeled addresses
         */
        $scope.filterAddresses = function(page, limit, sort_dir, searchText, hideUnused, hideUnlabeled) {
            $scope.isLoading = true;
            if (!searchText) searchText = "";

            var cacheKey = [searchText, limit, sort_dir, hideUnused, hideUnlabeled, page].join(":");
            var cached = $cache.get(cacheKey);

            return $q.when(cached)
                .then(function(cached) {
                    if (cached) {
                        return cached;
                    } else {
                        var options = {
                            page: page,
                            limit: limit,
                            sort_dir: sort_dir,
                            hide_unused: hideUnused,
                            hide_unlabeled: hideUnlabeled
                        };

                        if (searchText.length > 0) {
                            options.search = searchText;
                            options.search_label = searchText;
                        }

                        return activeWallet._sdkWallet.addresses(options).then(function (addrs) {
                            $cache.put(cacheKey, addrs);
                            return addrs;
                        });
                    }
                }).finally(function() {
                    // Just show a little loading, even from cache
                    $timeout(function() {
                        $scope.isLoading = false;
                    }, 200);
                });
        };

        $scope.changePage = function() {
            $scope.filterAddresses(
                $scope.currentPage,
                $scope.itemsPerPage,
                $scope.searchSortOrder,
                $scope.searchText,
                $scope.checkOnlyUsed,
                $scope.checkOnlyLabeled
            ).then(
                function (addrs) {
                    $scope.items = addrs.data;
                    $scope.totalItems = addrs.total;
                    $scope.pagesCount = Math.ceil($scope.totalItems / $scope.itemsPerPage);
                });
        };

        $scope.$watchGroup(['searchText', 'checkOnlyUsed', 'checkOnlyLabeled'], function(newVal, oldVal) {
            $scope.currentPage = 1;
            $scope.changePage();
        });
    })
;
