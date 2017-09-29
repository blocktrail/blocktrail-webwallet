(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("ReceiveCtrl", ReceiveCtrl);

    function ReceiveCtrl($scope, $rootScope, $q, CONFIG, activeWallet, settingsService, CurrencyConverter, Currencies, trackingService) {

        var walletData = activeWallet.getReadOnlyWalletData();
        var settingsData = settingsService.getReadOnlySettingsData();
        // get current active wallets native currency
        var nativeCurrency = CONFIG.NETWORKS[walletData.networkType].TICKER;

        var listenerGroupValues;

        $rootScope.pageTitle = "RECEIVE";

        $scope.isLoading = true;

        $scope.address = null;
        $scope.path = null;
        $scope.bitcoinUri = null;
        $scope.qrcode = null;

        $scope.newRequest = {
            address: null,
            path: null,
            btcValue: "",
            fiatValue: 0,
            message: null,
            bitcoinUri: ""
        };

        $scope.qrSettings = {
            correctionLevel: 7,
            SIZE: 225,
            inputMode: "M",
            image: true
        };

        $scope.swapInputs = function() {
            $scope.fiatFirst = !$scope.fiatFirst;
        };

        $scope.currencies = null;
        $scope.currencyType = null;
        $scope.altCurrency = {};

        // Methods
        $scope.updateCurrentType = updateCurrentType;
        $scope.setAltCurrency = setAltCurrency;

        $scope.$on("enabled_currency", function() {
            updateCurrentType($scope.currencyType);
        });

        $scope.$on("$destroy", onDestroy);

        initData();

        /**
         * Init data
         */
        function initData() {
            // set default BTC
            updateCurrentType(nativeCurrency);
            // generate the first address
            $q.when(getNewAddress())
                .then(function() {

                    generateQR();

                    // Add watchers
                    listenerGroupValues = $scope.$watchGroup(["newRequest.btcValue", "newRequest.address", "currencyType"], updateQRAndSetAltCurrency);

                    $scope.isLoading = false;
                });
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
                $scope.altCurrency.code = settingsData.localCurrency;
                $scope.altCurrency.amount = parseFloat(CurrencyConverter.fromBTC($scope.newRequest.btcValue, settingsData.localCurrency, 2)) || 0;
            } else {
                $scope.altCurrency.code = nativeCurrency;
                $scope.altCurrency.amount = parseFloat(CurrencyConverter.toBTC($scope.newRequest.btcValue, $scope.currencyType, 6)) || 0;
            }

            if ($scope.altCurrency.amount > 0) {
                trackingService.trackEvent(trackingService.EVENTS.RECEIVE_CUSTOM_AMOUNT);
            }
        }

        /**
         * Get new address
         */
        function getNewAddress() {
            $scope.newRequest.address = null;

            return $q.when(activeWallet.getNewAddress())
                .then(function(address) {
                    $scope.newRequest.address = address;
                })
                .catch(function(e) {
                    console.log(e);
                });
        }

        /**
         * Generate QR
         * @return { boolean }
         */
        function generateQR() {
            if (!$scope.newRequest.address) {
                return false;
            }

            $scope.newRequest.bitcoinUri = "bitcoin:" + $scope.newRequest.address;
            $scope.newRequest.qrValue = 0;

            if ($scope.currencyType === "BTC") {
                $scope.newRequest.qrValue = parseFloat($scope.newRequest.btcValue);
            } else if ($scope.currencyType === "tBTC") {
                $scope.newRequest.qrValue = parseFloat($scope.newRequest.btcValue);
            } else {
                $scope.newRequest.qrValue = parseFloat($scope.altCurrency.amount);
            }

            if (!isNaN($scope.newRequest.qrValue) && $scope.newRequest.qrValue.toFixed(8) !== "0.00000000") {
                $scope.newRequest.bitcoinUri += "?amount=" + $scope.newRequest.qrValue.toFixed(8);
            }
        }

        /**
         * Update the URI and QR code when address or value change
         * @param newValue
         * @param oldValue
         */
        function updateQRAndSetAltCurrency(newValue, oldValue) {
            if (newValue !== oldValue) {
                setAltCurrency();
                // ignore call from scope initialisation
                generateQR();
            }
        }

        /**
         * On destroy
         */
        function onDestroy() {
            if (listenerGroupValues) {
                listenerGroupValues();
            }
        }
    }
})();
