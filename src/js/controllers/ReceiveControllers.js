angular.module('blocktrail.wallet')
    .controller('ReceiveCtrl', function($scope, $rootScope, Wallet, CurrencyConverter, Currencies, $q, $timeout, $translate) {
        $rootScope.pageTitle = 'RECEIVE';

        $scope.paymentReceived       = false;

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
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.fromBTC($scope.newRequest.btcValue, $scope.settings.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code     = 'BTC';
                $scope.altCurrency.amount   = parseFloat(CurrencyConverter.toBTC($scope.newRequest.btcValue, $scope.currencyType, 6)) || 0;
            }
        };

        // set default BTC
        $scope.updateCurrentType('BTC');

        $scope.newAddress = function() {
            $scope.newRequest.address = null;

            $q.when(Wallet.getNewAddress()).then(function(address) {
                $scope.newRequest.address = address;
            });
        };

        $scope.generateQR = function() {
            if (!$scope.newRequest.address) {
                return false;
            }

            $scope.newRequest.bitcoinUri = "bitcoin:" + $scope.newRequest.address;
            $scope.newRequest.qrValue = 0;
            if ($scope.currencyType=='BTC') {
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
            if (oldValues != newValues) {
                //ignore call from scope initialisation
                $scope.generateQR();
            }
        });

        //generate the first address
        $scope.newAddress();

        $scope.$on('new_transactions', function(event, transactions) {
            //show popup (and maybe vibrate?) on new tx
            $scope.paymentReceived = true;

            //$log.debug('New Transaction have been found!!!', transactions);
            transactions.forEach(function(transaction) {

            });
        });
    })
;
