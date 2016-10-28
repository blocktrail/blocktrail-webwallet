angular.module('blocktrail.wallet')
   .controller('WalletCtrl', function($q, $log, $scope, $state, $rootScope, $interval, storageService, sdkService, Wallet,
                                      Contacts, CONFIG, settingsService, $timeout, launchService, blocktrailLocalisation,
                                      dialogService, $http, $translate) {

        $timeout(function() {
            $rootScope.hideLoadingScreen = true;
        }, 200);
        if (!$rootScope.settings.enablePolling) {
            Wallet.disablePolling();
        }

       /*
        * check for extra languages to enable
        *  if one is preferred, prompt user to switch
        */
       $rootScope.fetchExtraLanguages = $http.get(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "tBTC" : "BTC") + "/mywallet/config?v=" + CONFIG.VERSION)
           .then(function(result) {
               return result.data.extraLanguages;
           })
           .then(function(extraLanguages) {
               return settingsService.$isLoaded().then(function() {
                   // filter out languages we already know
                   var knownLanguages = blocktrailLocalisation.getLanguages();
                   extraLanguages = extraLanguages.filter(function(language) {
                       return knownLanguages.indexOf(language) === -1;
                   });

                   if (extraLanguages.length === 0) {
                       return;
                   }

                   // enable extra languages
                   _.each(extraLanguages, function(extraLanguage) {
                       blocktrailLocalisation.enableLanguage(extraLanguage, {});
                   });

                   // determine (new) preferred language
                   var preferredLanguage = blocktrailLocalisation.setupPreferredLanguage();

                   // store extra languages
                   settingsService.extraLanguages = settingsService.extraLanguages.concat(extraLanguages).unique();

                   return settingsService.$store()
                       .then(function() {
                           // check if we have a new preferred language
                           if (preferredLanguage != settingsService.language && extraLanguages.indexOf(preferredLanguage) !== -1) {
                               // prompt to enable
                               return dialogService.prompt({
                                   body: $translate.instant('MSG_BETTER_LANGUAGE', {
                                       oldLanguage: $translate.instant(blocktrailLocalisation.languageName(settingsService.language)),
                                       newLanguage: $translate.instant(blocktrailLocalisation.languageName(preferredLanguage))
                                   }).sentenceCase(),
                                   title: $translate.instant('MSG_BETTER_LANGUAGE_TITLE').sentenceCase(),
                                   prompt: false
                                })
                                   .result
                                   .then(function() {
                                       // enable new language
                                       settingsService.language = preferredLanguage;
                                       $rootScope.changeLanguage(preferredLanguage);

                                       return settingsService.$store();
                                   })
                               ;
                           }
                       })
                       ;
               });
           })
           .then(function() {}, function(e) { console.error('extraLanguages', e && (e.msg || e.message || "" + e)); });


       $rootScope.getPrice = function() {
            //get a live prices update
            return $q.when(Wallet.price(false).then(function(data) {
                return $rootScope.bitcoinPrices = data;
            }));
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

        $rootScope.syncProfile = function() {
            //sync profile if a pending update is present
            if (!settingsService.profileSynced) {
                settingsService.$syncProfileUp();
            }
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
        $timeout(function() { $rootScope.syncContacts(); }, 500);
        $timeout(function() { $rootScope.getPrice(); }, 1000);
        $timeout(function() { $rootScope.syncProfile(); }, 2000);

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

        var profileSyncPolling = $interval(function() {
            $rootScope.syncProfile();
        }, 301500); // 5 min + slight offset not to collide
    }
);

angular.module('blocktrail.wallet')
    .controller('WalletSummaryCtrl', function($scope, $rootScope, $state, $log, $filter, $http, $q, $timeout, Wallet,
                                              launchService, settingsService, $translate, $modal, CONFIG) {
        $rootScope.pageTitle = 'TRANSACTIONS';
        // update balance from cache
        $scope.transactionsList         = [];   //original list of transactions
        $scope.transactionsDisplayList  = [];    //transactions with "date headers" inserted
        $scope.isFirstLoad              = true;
        $scope.canLoadMoreTransactions  = true;
        $scope.loading                  = false;
        $scope.paginationOptions = {
            from: 0,
            limit: 15
        };
        $scope.lastDateHeader = 0;      //used to keep track of the last date header added

        // display 2FA warning once every day when it's not enabled
        $scope.twoFactorWarning = false;
        launchService.getAccountInfo().then(function(accountInfo) {
            var SECONDS_AGO = 86400;

            if (!accountInfo.requires2FA) {
                return settingsService.$isLoaded().then(function() {
                    var last = settingsService.twoFactorWarningLastDisplayed;
                    if (!last || last < (new Date()).getTime() - SECONDS_AGO * 1000) {
                        settingsService.twoFactorWarningLastDisplayed = (new Date()).getTime();
                        settingsService.$store().then(function() {
                            settingsService.$syncSettingsUp();
                        });

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

                $scope.transactionsList = $scope.transactionsList.concat(result);

                $scope.transactionsDisplayList = $scope.groupTransactions($scope.transactionsList);
                $scope.paginationOptions.from += result.length;
                $scope.canLoadMoreTransactions = result.length > 0;

                $log.debug("transactionsDisplayList", $scope.transactionsDisplayList, $scope.transactionsDisplayList.length);
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
                    date = new Date(transaction.time*1000);
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

                    //add a contact token
                    if (transaction.contact) {
                        if (!transaction.contact.lastName && transaction.contact.firstName) {
                            transaction.contactInitials = transaction.contact.firstName.substr(0, 2);
                        } else if (!transaction.contact.firstName && transaction.contact.lastName) {
                            transaction.contactInitials = transaction.contact.lastName.substr(0, 2);
                        } else if (transaction.contact.firstName && transaction.contact.lastName) {
                            transaction.contactInitials = transaction.contact.firstName.substr(0, 1) + transaction.contact.lastName.substr(0, 1);
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
                        return transaction
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
    .controller('WalletTxInfoCtrl', function($scope, $modalInstance, data) {
        $scope.data = data;

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        }
    })
;
