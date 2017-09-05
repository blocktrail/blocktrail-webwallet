(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("WalletSummaryCtrl", WalletSummaryCtrl);

    function WalletSummaryCtrl($scope, $rootScope, $q, $timeout, activeWallet, CONFIG,
                               launchService, settingsService, buyBTCService, $modal, CurrencyConverter) {

        var settings = settingsService.getReadOnlySettings();
        var transactionsListLimitStep = 15;
        var lastDateHeader = 0; // used to keep track of the last date header added
        var timeoutPromise = null;
        var timeoutDelay = 2000;

        $rootScope.pageTitle = 'TRANSACTIONS';
        $scope.walletData = activeWallet.getReadOnlyWalletData();
        $scope.isLoading = true;
        $scope.isShowNoMoreTransactions = false;
        $scope.isTwoFactorWarning = false; // display 2FA warning once every day when it's not enabled
        $scope.showBCCSweepWarning = true;
        $scope.lastDateHeader = lastDateHeader;
        $scope.buybtcPendingOrders = []; // Glidera transactions
        $scope.transactionsListLimit = transactionsListLimitStep;

        // Methods
        $scope.isHeader = isHeader;
        $scope.getTransactionHeader = getTransactionHeader;
        $scope.onShowTransaction = onShowTransaction;
        $scope.onShowMoreTransactions = onShowMoreTransactions;
        $scope.dismissBCCSweepWarning = dismissBCCSweepWarning;

        $scope.$on("$destroy", onDestroy);

        var initializingData = initData();

        if (CONFIG.NETWORK === "BCC") {
            initializingData.then(function() {
                $scope.showBCCSweepWarning = !$scope.walletData.transactions.length && !$scope.settings.hideBCCSweepWarning;
            });
        }

        /**
         * Init data
         */
        function initData() {
            return $q.all([
                $q.when($rootScope.getPrice()),
                $q.when(twoFactorWarning()),
                $q.when(getGlideraTransactions())
            ]).then(function() {
                $scope.isLoading = false;
            }, function (err) {
                console.log('err', err);
            });
        }

        function dismissBCCSweepWarning() {
            $scope.showBCCSweepWarning = false;
            settingsService.updateSettingsUp({
                hideBCCSweepWarning: true
            });
        }

        /**
         * Two factor warning
         *
         * if 2FA is turn off we display a message
         */
        function twoFactorWarning() {
            return $q.when(launchService.getAccountInfo())
                .then(function(accountInfo) {
                    var SECONDS_AGO = 86400;

                    if (!accountInfo.requires2FA) {

                        return settingsService.getSettings()
                            .then(function(settings) {
                                var last = settings.twoFactorWarningLastDisplayed;

                                if (!last || last < (new Date()).getTime() - SECONDS_AGO * 1000) {
                                    var updateSettings = {
                                        twoFactorWarningLastDisplayed: (new Date()).getTime()
                                    };

                                    settingsService.updateSettingsUp(updateSettings);

                                    $scope.isTwoFactorWarning = true;
                                }
                            });
                    }
                });
        }

        /**
         * Get glidera transactions
         *
         * TODO move this logic to Wallet class
         */
        function getGlideraTransactions() {
            return settingsService.getSettings()
                .then(function(settings) {
                    $scope.buybtcPendingOrders = [];

                    settings.glideraTransactions.forEach(function(glideraTxInfo) {
                        // don't display completed TXs, they will be part of our normal transaction history
                        if (glideraTxInfo.transactionHash || glideraTxInfo.status === "COMPLETE") {
                            return;
                        }

                        // only display TXs that are related to this wallet
                        if (glideraTxInfo.walletIdentifier !== $scope.walletData.identifier) {
                            return;
                        }

                        var order = {
                            qty: CurrencyConverter.toSatoshi(glideraTxInfo.qty, 'BTC'),
                            qtyBTC: glideraTxInfo.qty,
                            currency: glideraTxInfo.currency,
                            price: glideraTxInfo.price,
                            total: (glideraTxInfo.price * glideraTxInfo.qty).toFixed(2),
                            time: glideraTxInfo.time,
                            avatarUrl: buyBTCService.BROKERS.glidera.avatarUrl,
                            displayName: buyBTCService.BROKERS.glidera.displayName
                        };

                        $scope.buybtcPendingOrders.push(order);
                });

                // latest first
                $scope.buybtcPendingOrders.reverse();
            });
        }

        /**
         * On show more transactions
         *
         * Handler for "infinite-scroll" directive
         */
        function onShowMoreTransactions() {
            if($scope.transactionsListLimit < $scope.walletData.transactions.length) {
                $scope.transactionsListLimit = $scope.transactionsListLimit + transactionsListLimitStep;
            } else if (!$scope.isLoading && $scope.walletData.transactions.length && $scope.transactionsListLimit >= $scope.walletData.transactions.length) {
                $scope.isShowNoMoreTransactions = true;

                if(timeoutPromise) {
                    $timeout.cancel(timeoutPromise);
                }

                timeoutPromise = $timeout(function () {
                    timeoutPromise = null;
                    $scope.isShowNoMoreTransactions = false;
                }, timeoutDelay);
            }
        }

        /**
         * Is header
         *
         * @param transaction
         * @return {boolean}
         */
        function isHeader(transaction) {
            var isHeader = false;
            var date = new Date(transaction.time * 1000);

            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);

            if (lastDateHeader !== date.valueOf()) {
                lastDateHeader = date.valueOf();
                isHeader = true;
            }

            return isHeader;
        }

        /**
         * Get transaction header
         *
         * @return {number}
         */
        function getTransactionHeader() {
            return lastDateHeader;
        }

        /**
         * On show transaction
         *
         * @param transaction
         */
        function onShowTransaction(transaction) {
            $modal.open({
                controller: "WalletTransactionInfoModalCtrl",
                templateUrl: "js/modules/wallet/controllers/wallet-transaction-info-modal/wallet-transaction-info-modal.tpl.html",
                resolve: {
                    data: function() {
                        return {
                            transaction: angular.copy(transaction),
                            localCurrency: settings.localCurrency
                        }
                    }
                }
            });
        }

        /**
         * On destroy
         */
        function onDestroy() {
            if(timeoutPromise) {
                $timeout.cancel(timeoutPromise);
            }
        }
    }

})();
