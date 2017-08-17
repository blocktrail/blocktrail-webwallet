(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("WalletSummaryCtrl", WalletSummaryCtrl);

    function WalletSummaryCtrl($scope, $rootScope, $q, activeWallet,
                               launchService, settingsService, buyBTCService, $modal, CurrencyConverter) {

        var settings = settingsService.getReadOnlySettings();
        var transactionsListLimitStep = 5;
        var lastDateHeader = 0; // used to keep track of the last date header added

        $rootScope.pageTitle = 'TRANSACTIONS';
        $scope.buybtcPendingOrders = [];

        $scope.isShowNoMoreTransactions = false;
        $scope.isLoading = true;

        $scope.transactionsListLimit = transactionsListLimitStep;
        $scope.lastDateHeader = lastDateHeader;

        $scope.transactions = activeWallet.getTransactionsList();
        // $scope.transactions = [];

        // display 2FA warning once every day when it's not enabled
        $scope.twoFactorWarning = false;

        launchService.getAccountInfo().then(function(accountInfo) {
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

                            $scope.twoFactorWarning = true;
                        }
                    });
            }
        });

        // Methods
        $scope.isHeader = isHeader;
        $scope.getTransactionHeader = getTransactionHeader;
        $scope.onShowTransaction = onShowTransaction;
        $scope.onShowMoreTransactions = onShowMoreTransactions;

        initData();

        function initData() {
            //refresh transactions, block height and wallet balance
            $q.all([
                $q.when($rootScope.getPrice()),
                $q.when($rootScope.getBalance()),
                $q.when($rootScope.getBlockHeight()),
                $q.when(activeWallet.getTransactions()),
                $q.when(getGlideraTransactions())
            ]).then(function() {
                $scope.isLoading = false;
            }, function (err) {
                console.log('err', err);
            });
        }
        
        function getGlideraTransactions() {
            return settingsService.getSettings().then(function(settings) {
                $scope.buybtcPendingOrders = [];

                settings.glideraTransactions.forEach(function(glideraTxInfo) {
                    if (glideraTxInfo.transactionHash || glideraTxInfo.status === "COMPLETE") {
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

        function onShowMoreTransactions() {
            if($scope.transactionsListLimit < $scope.transactions.length) {
                $scope.transactionsListLimit = $scope.transactionsListLimit + transactionsListLimitStep;
            } else if ($scope.transactionsListLimit >= $scope.transactions.length) {

            }
        }

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

        function getTransactionHeader() {
            return lastDateHeader;
        }

        function onShowTransaction(transaction) {
            $modal.open({
                controller: "WalletTransactionInfoModalCtrl",
                templateUrl: "js/modules/wallet/controllers/wallet-transaction-info-modal/wallet-transaction-info-modal.tpl.html",
                resolve: {
                    data: function() {
                        return {
                            transaction: transaction,
                            localCurrency: settings.localCurrency
                        }
                    }
                }
            })
        };
    }

})();
