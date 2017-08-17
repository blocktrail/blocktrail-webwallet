(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("WalletSummaryCtrl", WalletSummaryCtrl);

    function WalletSummaryCtrl($scope, $rootScope, $log, $q, activeWallet,
                               launchService, settingsService, buyBTCService, $modal, CurrencyConverter) {


        $rootScope.pageTitle = 'TRANSACTIONS';
        // update balance from cache
        $scope.transactionsList = [];   // original list of transactions
        $scope.buybtcPendingOrders = [];
        $scope.isFirstLoad = true;
        $scope.canLoadMoreTransactions = true;
        $scope.loading = false;

        var settings = settingsService.getReadOnlySettings();

        var transactionsListLimitStep = 5;
        var lastDateHeader = 0; // used to keep track of the last date header added

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

        $scope.refreshTransactions = function() {
            $log.debug('refresh transactions...');

            //refresh transactions, block height and wallet balance
            $q.all([
                $q.when($rootScope.getBalance()),
                $q.when($rootScope.getPrice()),
                $q.when($rootScope.getBlockHeight()),
                $q.when(activeWallet.pollTransactions())
            ]).then(function(res) {

                // activeWallet.resetHistory();
                $scope.getTransactions().then(function() {
                    $scope.loading = false;
                    $scope.isFirstLoad = false;
                });
            }, function (err) {
                console.log('err', err);
            });
        };

        $scope.getTransactions = function(from, limit, reset) {
            $log.debug('getTransactions', from, limit);
            //get cached transactions
            return activeWallet.getTransactions(from, limit).then(function(result) {

            })
                .then(function() {
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
                });
        };


        $scope.showMoreTransactions = function() {
            if($scope.transactionsListLimit < $scope.transactions.length) {
                $scope.transactionsListLimit = $scope.transactionsListLimit + transactionsListLimitStep;
            }
        };

        $scope.isHeader = function(transaction) {
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
        };

        $scope.getTransactionHeader = function () {
            return lastDateHeader;
        };

        $scope.onShowTransaction = function(transaction) {
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

        $scope.refreshTransactions();
    }

})();
