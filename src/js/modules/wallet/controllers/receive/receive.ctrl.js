(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("ReceiveCtrl", ReceiveCtrl);

    function ReceiveCtrl($scope, $rootScope, CONFIG, activeWallet, settingsService, CurrencyConverter,
                         Currencies, $q, trackingService) {
        // get current active wallets native currency
        var NATIVE_CURRENCY = CONFIG.NETWORKS[$scope.walletData.networkType].TICKER;

        $scope.settings = settingsService.getReadOnlySettings();

        $rootScope.pageTitle = 'RECEIVE';

        $scope.isLoading = false;

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

        // TODO Here
        $scope.$on('enabled_currency', function() {
            $scope.updateCurrentType($scope.currencyType);
        });

        $scope.updateCurrentType = function(currencyType) {
            $scope.currencies = Currencies.getCurrencies();

            // filter out crypto currencies that are not current
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.isFiat || currency.code === NATIVE_CURRENCY;
            });

            // filter out selected currency
            $scope.currencies = $scope.currencies.filter(function(currency) {
                return currency.code !== currencyType;
            });

            $scope.currencyType = currencyType;

            $scope.setAltCurrency();
        };

        $scope.setAltCurrency = function() {
            if ($scope.currencyType === NATIVE_CURRENCY) {
                $scope.altCurrency.code     = $scope.settings.localCurrency;
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.fromBTC($scope.newRequest.btcValue, $scope.settings.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code     = NATIVE_CURRENCY;
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.toBTC($scope.newRequest.btcValue, $scope.currencyType, 6)) || 0;
            }

            if ($scope.altCurrency.amount > 0) {
                trackingService.trackEvent(trackingService.EVENTS.RECEIVE_CUSTOM_AMOUNT);
            }
        };

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

        // set default BTC
        $scope.updateCurrentType(NATIVE_CURRENCY);
        //generate the first address
        $scope.newAddress();
    }
})();
