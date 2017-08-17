angular.module('blocktrail.wallet')
    .controller('OLD_WalletCtrl', function($q, $log, $scope, $state, $rootScope, $interval, storageService, sdkService, Wallet, $modal,
                                       Contacts, CONFIG, settingsService, setupService, $timeout, launchService, blocktrailLocalisation,
                                       dialogService, $http, $translate, buyBTCService, Currencies, AppVersionService, $filter) {

        $timeout(function() {
            $rootScope.hideLoadingScreen = true;
        }, 200);

        $scope.settings = settingsService.getReadOnlySettings();

        // TODO remove from root scope
        if ($scope.settings.enablePolling) {
            Wallet.disablePolling();
        }
        // add info from setup process to the settings
        setupService.getUserInfo().then(function(userInfo) {
            if (userInfo.username || userInfo.displayName || userInfo.email) {
                var updateSettings = {
                    username: userInfo.username || $scope.settings.username,
                    displayName: userInfo.displayName || $scope.settings.displayName,
                    email: userInfo.email || $scope.settings.email
                };

                setupService.clearUserInfo();
                settingsService.updateSettingsUp(updateSettings);
            }
        }, function(e) {
            console.error('getUserInfo', e);
        });

        $scope.$on('glidera_complete', function(event, transaction) {
            dialogService.alert({
                body: $translate.instant('MSG_BUYBTC_GLIDERA_COMPLETE_BODY', {
                    qty: transaction.qty
                }),
                title: 'MSG_BUYBTC_GLIDERA_COMPLETE'
            })
        });

        /*
         * check for extra languages to enable
         * if one is preferred, prompt user to switch
         */
        // TODO move the logic to service
        $rootScope.fetchExtraLanguages = launchService.getWalletConfig()
            .then(function(result) {
                if (result.api_key && (result.api_key !== 'ok')) {
                    // alert user session is invalid
                    dialogService.alert({
                        title: $translate.instant('INVALID_SESSION'),
                        bodyHtml: $filter('nl2br')($translate.instant('INVALID_SESSION_LOGOUT_NOW'))
                    })
                        .result
                        .finally(function() {
                            $state.go('app.logout');
                        });

                    // force flushing the storage already
                    storageService.resetAll();
                    return;
                }

                settingsService.getSettings().then(function(settings) {
                    // check if we need to display any update notices
                    AppVersionService.checkVersion(settings.latestVersionWeb, result.versionInfo.web, AppVersionService.CHECKS.LOGGEDIN);

                    // store the latest version we've used
                    if (!settings.latestVersionWeb || semver.gt(CONFIG.VERSION, settings.latestVersionWeb)) {
                        $timeout(function() {
                            var updateSettings = {
                                latestVersionWeb: CONFIG.VERSION
                            };

                            settingsService.updateSettingsUp(updateSettings);
                        }, 500);
                    }
                });

                if (result.currencies) {
                    result.currencies.forEach(function (currency) {
                        Currencies.enableCurrency(currency);
                    });
                }

                return result.extraLanguages.concat(CONFIG.EXTRA_LANGUAGES).unique();
            })
            .then(function(extraLanguages) {
                return settingsService.getSettings().then(function(settings) {
                    (settings.extraLanguages || []).forEach(function(language) {
                        blocktrailLocalisation.enableLanguage(language);
                    });

                    // determine (new) preferred language
                    var r = blocktrailLocalisation.parseExtraLanguages(extraLanguages);

                    if (r) {
                        var newLanguages = r[0];
                        var preferredLanguage = r[1];

                        // store extra languages
                        var updateSettings = {
                            extraLanguages: settings.extraLanguages.concat(newLanguages).unique()
                        };

                        return settingsService.updateSettingsUp(updateSettings)
                            .then(function(settings) {
                                // check if we have a new preferred language
                                if (preferredLanguage != settings.language && extraLanguages.indexOf(preferredLanguage) !== -1) {
                                    // prompt to enable
                                    return dialogService.prompt({
                                        body: $translate.instant('MSG_BETTER_LANGUAGE', {
                                            oldLanguage: $translate.instant(blocktrailLocalisation.languageName(settings.language)),
                                            newLanguage: $translate.instant(blocktrailLocalisation.languageName(preferredLanguage))
                                        }),
                                        title: $translate.instant('MSG_BETTER_LANGUAGE_TITLE'),
                                        prompt: false
                                    })
                                        .result
                                        .then(function() {
                                            // enable new language
                                            var updateSettings = {
                                                extraLanguages: preferredLanguage
                                            };
                                            // TODO root scope language should have a subscription on property language from settings service
                                            $rootScope.changeLanguage(preferredLanguage);
                                            return settingsService.updateSettingsUp(updateSettings);
                                        });
                                }
                            });
                    }
                });
            })
            .then(
                function() {},
                function(e) {
                    console.error('extraLanguages', e && (e.msg || e.message || "" + e));
                }
            );


        $rootScope.getPrice = function() {
            return Currencies.updatePrices(false)
                .then(function(prices) {
                    $rootScope.bitcoinPrices = prices;
                });
        };

        $rootScope.getBlockHeight = function() {
            //get a live block height update (used to calculate confirmations)
            return $q.when(Wallet.blockHeight(false).then(function(data) {
                return $rootScope.blockHeight = data.height;
            }));
        };

        $rootScope.getBalance = function() {
            //get a live balance update
            return $q.when(Wallet.balance(false).then(function(balanceData) {
                // @TODO: GA equivilant
                // if ((balanceData.balance > 0 || balanceData.uncBalance > 0) && !$ionicUser.get().isActive) {
                //     $ionicUser.identify({user_id: $ionicUser.get().user_id, isActive: 1});
                //     $ionicAnalytics.track('Actived', {});
                // }

                $rootScope.balance = balanceData.balance;
                $rootScope.uncBalance = balanceData.uncBalance;
                return {balance: balanceData.balance, uncBalance: balanceData.uncBalance};
            }));
        };

        $rootScope.syncContacts = function() {
            //sync any changes to contacts
            Contacts.list()
                .catch(function(err) {
                    $log.error(err);
                })
            ;
        };

        // do initial updates then poll for changes, all with small offsets to reducing blocking / slowing down of rendering
        $timeout(function() {
            $rootScope.syncContacts();
        }, 500);
        $timeout(function() {
            $rootScope.getPrice();
        }, 1000);

        var pricePolling = $interval(function() {
            $rootScope.getPrice();
        }, 20000);

        var balancePolling = $interval(function() {
            $rootScope.getBalance();
        }, 15000);

        var blockheightPolling = $interval(function() {
            $rootScope.getBlockHeight();
        }, 15500); // slight offset not to collide

        var contactSyncPolling = $interval(function() {
            $rootScope.syncContacts();
        }, 300500); // 5 min + slight offset not to collide

        var settingsSyncPolling = $interval(function() {
            settingsService.syncSettingsDown();
        }, 302000); // 5 min + slight offset not to collide
    }
);

angular.module('blocktrail.wallet')
    .controller('OLD_WalletSummaryCtrl', function($scope, $rootScope, $state, $log, $filter, $http, $q, $timeout, Wallet,
                                              launchService, settingsService, buyBTCService, $translate, $modal, CONFIG, CurrencyConverter) {
        $rootScope.pageTitle = 'TRANSACTIONS';
        // update balance from cache
        $scope.transactionsList = [];   //original list of transactions
        $scope.transactionsDisplayList = [];    //transactions with "date headers" inserted
        $scope.buybtcPendingOrders = [];
        $scope.isFirstLoad = true;
        $scope.canLoadMoreTransactions = true;
        $scope.loading = false;
        $scope.paginationOptions = {
            from: 0,
            limit: 15
        };
        $scope.lastDateHeader = 0;      //used to keep track of the last date header added

        $scope.settings = settingsService.getReadOnlySettings();

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
                $q.when(Wallet.pollTransactions())
            ]).then(function() {
                // remove all previously unconfirmed txs
                $scope.transactionsList.forEach(function(tx, index) {
                    if (!tx.block_height) {
                        delete $scope.transactionsList[index];
                    }
                });

                $scope.paginationOptions.from = 0;
                $scope.getTransactions($scope.paginationOptions.from, $scope.paginationOptions.limit, true).then(function() {
                    $scope.loading = false;
                    $scope.isFirstLoad = false;
                });
            });
        };

        $scope.getTransactions = function(from, limit, reset) {
            $log.debug('getTransactions', from, limit);
            //get cached transactions
            return Wallet.transactions(from, limit).then(function(result) {
                if (reset) {
                    $scope.lastDateHeader = 0;
                    $scope.transactionsList = [];
                    $scope.transactionsDisplayList = [];
                }

                if (CONFIG.TX_FILTER_MIN_BLOCK_HEIGHT) {
                    result = result.filter(function(tx) {
                        return tx.block_height === null || tx.block_height >= CONFIG.TX_FILTER_MIN_BLOCK_HEIGHT;
                    });
                }

                $scope.transactionsList = $scope.transactionsList.concat(result);

                $scope.transactionsDisplayList = $scope.groupTransactions($scope.transactionsList);
                $scope.paginationOptions.from += result.length;
                $scope.canLoadMoreTransactions = result.length > 0;

                $log.debug("transactionsDisplayList", $scope.transactionsDisplayList, $scope.transactionsDisplayList.length);
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

        $scope.loadMoreTransactions = function() {
            $log.debug('loadMoreTransactions', $scope.loading);
            if ($scope.loading) {
                return;
            }

            $scope.loading = true;
            // may need to merge existing data set when getting more results?
            // or else check for existing entries so they aren't added more than once when grouping data
            $scope.getTransactions($scope.paginationOptions.from, $scope.paginationOptions.limit).then(function() {
                $scope.loading = false;
                $scope.isFirstLoad = false;
            });
        };

        $scope.groupTransactions = function(data) {
            $scope.lastDateHeader = 0;

            var groupedList = [];

            data.forEach(function(transaction) {
                var date = null;

                if (transaction.hash) {
                    date = new Date(transaction.time * 1000);
                    date.setHours(0);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    date.setMilliseconds(0);
                    date = date.valueOf();

                    //create the header object
                    if (date < $scope.lastDateHeader || $scope.lastDateHeader == 0) {
                        $scope.lastDateHeader = date;
                        var headerObj = {isHeader: true, date: date};
                        groupedList.push(headerObj);
                    }

                    if (!transaction.contact && transaction.buybtc) {
                        var broker = buyBTCService.BROKERS[transaction.buybtc.broker];

                        transaction.contact = {
                            displayName: broker.displayName,
                            avatarUrl: broker.avatarUrl
                        };
                    }

                    //add a contact token
                    if (transaction.contact) {
                        if (!transaction.contact.lastName && transaction.contact.firstName) {
                            transaction.contactInitials = transaction.contact.firstName.substr(0, 2);
                        } else if (!transaction.contact.firstName && transaction.contact.lastName) {
                            transaction.contactInitials = transaction.contact.lastName.substr(0, 2);
                        } else if (transaction.contact.firstName && transaction.contact.lastName) {
                            transaction.contactInitials = transaction.contact.firstName.substr(0, 1) + transaction.contact.lastName.substr(0, 1);
                        } else if (transaction.contact.displayName) {
                            transaction.contactInitials = transaction.contact.displayName.substr(0, 2);
                        }
                    }

                    if (transaction.wallet_value_change > 0) {
                        // received from anonymous
                        // disabled displaying recieved from
                        // transaction.otherAddresses = transaction.txin_other_addresses.join(", ");
                        transaction.altDisplay = $translate.instant('TX_INFO_RECEIVED');
                    } else if (transaction.is_internal) {
                        //sent to self
                        transaction.otherAddresses = null;
                        transaction.altDisplay = $translate.instant('INTERNAL_TRANSACTION_TITLE');
                    } else {
                        //sent to anonymous
                        transaction.otherAddresses = transaction.txout_other_addresses.join(", ");
                        transaction.altDisplay = $translate.instant('TX_INFO_SENT');
                    }

                    groupedList.push(transaction);
                }
            });

            return groupedList;
        };

        $scope.showTransaction = function(transaction) {
            $modal.open({
                controller: 'WalletTxInfoCtrl',
                templateUrl: 'templates/wallet/wallet.tx-info.modal.html',
                resolve: {
                    data: function() {
                        return {
                            transaction: transaction,
                            localCurrency: $scope.settings.localCurrency
                        }
                    }
                }
            })
        };

        $scope.$on('new_transactions', function(event, transactions) {
            $log.debug('New Transaction have been found!!!', transactions);

            // remove all previously unconfirmed txs
            console.log($scope.transactionsList);
            $scope.transactionsList.forEach(function(tx, index) {

                if (!tx.block_height) {
                    delete $scope.transactionsList[index];
                }
            });

            transactions.forEach(function(transaction) {
                $scope.transactionsList.unshift(transaction);
            });

            $scope.$apply(function() {
                $scope.transactionsDisplayList = $scope.groupTransactions($scope.transactionsList);
                $scope.$broadcast('scroll.infiniteScrollComplete');
            });
        });

        $scope.$on('confirmed_transactions', function(event, confirmedTxs) {
            $log.debug('Transactions have been confirmed!!!', confirmedTxs);
            //refresh the txs that have changed (just update the block heights)
            $scope.$apply(function() {
                $scope.transactionsDisplayList.forEach(function(transaction) {
                    $log.debug('checking tx: ' + transaction.hash + ' against ' + confirmedTxs.length);
                    if (!confirmedTxs.length) {
                        return;
                    }
                    confirmedTxs.forEach(function(confirmedTx, index) {
                        if (confirmedTx.hash == transaction.hash) {
                            $log.debug('found and updated!');
                            transaction.block_height = confirmedTx.block_height;
                            //remove from array to speed things up
                            delete confirmedTxs[index];
                        }
                    });
                });
            });
        });

        $scope.$on('ORPHAN', function() {
            $timeout(function() {
                $log.debug('WalletCtrl.ORPHAN');

                $scope.refreshTransactions();
            });
        });

        $scope.refreshTransactions();
    })
;

angular.module('blocktrail.wallet')
    .controller('OLD_WalletTxInfoCtrl', function($scope, $modalInstance, data) {
        $scope.data = data.transaction;
        $scope.localCurrency = data.localCurrency;

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        }
    });
