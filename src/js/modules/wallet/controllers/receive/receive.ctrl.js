(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("ReceiveCtrl", ReceiveCtrl);

    function ReceiveCtrl($scope, $rootScope, $q, CONFIG, activeWallet, settingsService, CurrencyConverter, Currencies,
                         trackingService) {

        var walletData = activeWallet.getReadOnlyWalletData();
        var settingsData = settingsService.getReadOnlySettingsData();
        // get current active wallets native currency
        var nativeCurrency = CONFIG.NETWORKS[walletData.networkType].TICKER;

        var listenerGroupValues;

        $rootScope.pageTitle = "RECEIVE";

        $scope.isLoading = true;

        $scope.useCashAddress = CONFIG.NETWORKS[walletData.networkType].CASHADDRESS;

        $scope.newRequest = {
            address: null,
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
        $scope.$watch("useCashAddress", function(newValue, oldValue) {
            if (newValue !== oldValue && $scope.newRequest.address) {
                if (newValue) {
                    $scope.newRequest.address = activeWallet.getSdkWallet().sdk.getCashAddressFromLegacyAddress($scope.newRequest.address);
                } else {
                    $scope.newRequest.address = activeWallet.getSdkWallet().sdk.getLegacyBitcoinCashAddress($scope.newRequest.address);
                }
            }
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

            var chainIdx = null;
            if (walletData.networkType === "BCC") {
                chainIdx = blocktrailSDK.Wallet.CHAIN_BCC_DEFAULT;
            } else if (walletData.networkType === "BTC") {
                chainIdx = blocktrailSDK.Wallet.CHAIN_BTC_DEFAULT;
            }

            return $q.when(activeWallet.getNewAddress(chainIdx))
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

            var prefix = CONFIG.NETWORKS[walletData.networkType].URIPREFIX;
            if (!$scope.useCashAddress) {
                $scope.newRequest.bitcoinUri = prefix + $scope.newRequest.address;
            } else {
                $scope.newRequest.bitcoinUri = $scope.newRequest.address;
            }

            $scope.newRequest.qrValue = 0;

            if ($scope.currencyType === nativeCurrency) {
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
