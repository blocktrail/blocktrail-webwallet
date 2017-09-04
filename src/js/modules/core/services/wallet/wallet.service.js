(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('walletService', function($q, $timeout, bitcoinJS, sdkService, storageService, settingsService, Contacts) {
            return new WalletService($q, $timeout, bitcoinJS, sdkService, storageService, settingsService, Contacts)
        });
    
    function WalletService($q, $timeout, bitcoinJS, sdkService, storageService, settingsService, Contacts) {
        var self = this;

        self._$q = $q;
        self._$timeout = $timeout;
        self._bitcoinJS = bitcoinJS;
        self._sdk = sdkService;
        self._storageService = storageService;
        self._settingsService = settingsService;
        self._contactsService = Contacts;
    }

    WalletService.prototype.initWallet = function(walletId) {
        var self = this;

        return self._$q.when(self._sdk.sdk())
            .then(self._sdkInitWallet.bind(self, walletId), self._errorHandler.bind(self))
            .then(self._initWallet.bind(self, walletId));
    };

    WalletService.prototype._sdkInitWallet = function(walletId, sdk) {
        return sdk.initWallet({
            identifier: walletId,
            readOnly: true,
            bypassNewAddressCheck: true
        });
    };

    WalletService.prototype._initWallet = function(walletId, sdkWallet) {
        var self = this;
        var wallet =  new Wallet(sdkWallet, self._$q, self._$timeout,  self._bitcoinJS, self._storageService, self._settingsService, self._contactsService);

        return wallet.isReady;
    };

    WalletService.prototype._errorHandler = function(e) {
        throw new Error(e);
    };


    /**
     * WALLET CLASS
     * @param sdkWallet
     * @param $q
     * @param $timeout
     * @param bitcoinJS
     * @param storageService
     * @param settingsService
     * @param contactsService
     * @constructor
     */
    // TODO Remove glidera transactions form the settings service and remove 'settingsService' from wallet
    // TODO Create a method for updating contacts and and remove 'contactsService' from wallet
    // TODO Or try to handle this in the avatar directive
    function Wallet(sdkWallet, $q, $timeout, bitcoinJS, storageService, settingsService, contactsService) {
        var self = this;

        self._$q = $q;
        self._$timeout = $timeout;
        self._bitcoinJS = bitcoinJS;
        self._contactsService = contactsService;
        self._settingsService = settingsService;

        self._isInitData = false;

        // Flags with promises
        self._pollPromise = null;
        self._pollTimeout = null;

        self._pollingInterval = 15000;
        self._noPolling = false;

        // Access to SDK and Storage
        self._sdkWallet = sdkWallet;
        self._walletStore = storageService.db('wallet');

        // Wallet data
        self._walletData = {
            transactions: [],
            balance: 0,
            uncBalance: 0,
            blockHeight: 0,
            identifier: self._sdkWallet.identifier
        };

        self.isReady = self._initData();

        // Read only wallet data object
        // the object would be shared
        self._readonlyDoc = {
            readonly: true
        };

        angular.forEach(self._walletData, function(value, key) {
            Object.defineProperty(self._readonlyDoc, key, {
                set: function() {
                    throw new Error("Read only object. Blocktrail core module, wallet service.");
                },
                get: function() {
                    return self._walletData[key];
                }
            });
        });

        // TODO Check it
        self._amountOfOfflineAddresses = 30;
        self.isRefilling = null;
        self.addressRefillPromise = null;
    }

    Wallet.prototype.getReadOnlyWalletData = function() {
        var self = this;

        return self._readonlyDoc;
    };

    Wallet.prototype._initData = function() {
        var self = this;

        if (self._isInitData) {
            return self._$q.when(self);
        } else {
            return self._$q.all([self._getBalance(), self._pollTransactionsAndGetBlockHeight()])
                .then(self._getTransactions.bind(self))
                .then(function() {
                    self._isInitData = true;
                    return self._$q.when(self);
                });
        }
    };

    /**
     * START polling
     */

    /**
     * Disable polling
     */
    Wallet.prototype.disablePolling = function() {
        var self = this;

        if(self._pollTimeout) {
            self._$timeout.cancel(self._pollTimeout);
        }

        self._noPolling = true;
    };

    /**
     * Enable polling
     */
    Wallet.prototype.enablePolling = function() {
        var self = this;

        self._noPolling = false;

        self._pollTransactionsAndGetBlockHeight();
    };

    /**
     * Force polling
     */
    Wallet.prototype.forcePolling = function() {
        var self = this;

        if(self._pollTimeout) {
            self._$timeout.cancel(self._pollTimeout);
        }

        self._pollTransactionsAndGetBlockHeight();
    };

    /**
     * Setup a timeout
     * @return { boolean }
     * @private
     */
    Wallet.prototype._setupTimeout = function() {
        var self = this;

        if(!self._noPolling) {
            self._pollTimeout = self._$timeout(self._pollTransactionsAndGetBlockHeight.bind(self), self._pollingInterval);
        }

        return true;
    };

    /**
     * Poll transactions and get the block height
     * @return { promise }
     * @private
     */
    Wallet.prototype._pollTransactionsAndGetBlockHeight = function() {
        var self = this;

        if (self._pollPromise) {
            return self._pollPromise;
        }

        // TODO Add 'self.refillOfflineAddresses(1);' to polling
        return self._pollPromise = self._$q.all([self._pollTransactions(), self._getBlockHeight()])
            .then(self._resetPollPromise.bind(self))
            .then(self._setupTimeout.bind(self));
    };

    /**
     * END polling
     */

    /**
     * START Reset wallet data
     */

    /**
     * Reset the wallet data
     * @return { promise }
     * @private
     */
    Wallet.prototype._resetWalletData = function() {
        var self = this;

        return self._walletStore.allDocs({
                include_docs: true,
                attachments: true,
                startkey: self._sdkWallet.identifier,
                endkey: self._sdkWallet.identifier + "\ufff0"
            })
            .then(self._getAllWalletDocumentsSuccessHandler.bind(self));
    };

    /**
     * Get all wallet documents, the success handler
     * @return { promise }
     * @private
     */
    Wallet.prototype._getAllWalletDocumentsSuccessHandler = function(result) {
        var self = this;
        var promises = [];

        result.rows.forEach(function(row) {
            promises.push(self._deleteDocumentFromStorage(row.doc));
        });

        return self._$q.all(promises);
    };

    /**
     * Delete a document from the storage
     * @return { promise }
     * @private
     */
    Wallet.prototype._deleteDocumentFromStorage = function(doc) {
        var self = this;

        return self._walletStore.remove(doc);
    };

    /**
     * END Reset wallet data
     */

    /**
     * START Wallet balance
     */

    /**
     * Get the wallet balance
     * @returns _walletData { promise }
     * @private
     */
    Wallet.prototype._getBalance = function() {
        var self = this;

        return self._getBalanceFromStorage()
            .then(self._getBalanceFromSdk.bind(self))
            .then(self._setBalanceToStorage.bind(self))
            .then(self._updateBalanceInWalletDataObject.bind(self), self._errorHandler);
    };

    /**
     * Get the balance document from the storage
     * @returns balanceDoc { promise } {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromStorage = function() {
        var self = this;

        return self._$q.when(self._walletStore.get(self._getUniqueId("balance")))
            .then(self._getBalanceFromStorageSuccessHandler.bind(self), self._getBalanceFromStorageErrorHandler.bind(self));
    };

    /**
     * Get the balance document from the storage, the success handler
     * @param balanceDoc
     * @return balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromStorageSuccessHandler = function(balanceDoc) {
        return balanceDoc;
    };

    /**
     * Get the balance document from the storage, the error handler
     * @return {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromStorageErrorHandler = function() {
        var self = this;

        return {
            _id: self._getUniqueId("balance"),
            balance: 0,
            uncBalance: 0
        };
    };

    /**
     * Get the balance from SDK
     * @param balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @returns balanceDoc { promise } {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromSdk = function(balanceDoc) {
        var self = this;

        return self._$q.when(self._sdkWallet.getBalance())
            .then(self._getBalanceFromSdkSuccessHandler.bind(self, balanceDoc), self._getBalanceFromSdkErrorHandler.bind(self, balanceDoc))
    };

    /**
     * Get the balance from the sdk, the success handler
     * @param balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @param result { array }
     * @return {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromSdkSuccessHandler = function(balanceDoc, result) {
        balanceDoc.balance = result[0];
        balanceDoc.uncBalance = result[1];

        return balanceDoc;
    };

    /**
     * Get the balance from the sdk, the error handler
     * @param balanceDoc
     * @return balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._getBalanceFromSdkErrorHandler = function(balanceDoc) {
        return balanceDoc;
    };

    /**
     * Set the balance document to the storage
     * @param balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @returns balanceDoc { promise } {{ _id: string, balance: number, uncBalance: number }}
     * @private
     */
    Wallet.prototype._setBalanceToStorage = function(balanceDoc) {
        var self = this;

        return self._$q.when(self._walletStore.put(balanceDoc))
            .then(function() { return balanceDoc; });
    };

    /**
     * Update balance in the wallet data object
     * @param balanceDoc {{ _id: string, balance: number, uncBalance: number }}
     * @returns _walletData { object }
     * @private
     */
    Wallet.prototype._updateBalanceInWalletDataObject = function(balanceDoc) {
        var self = this;

        self._walletData.balance = balanceDoc.balance;
        self._walletData.uncBalance = balanceDoc.uncBalance;

        return self._walletData;
    };

    /**
     * END Wallet balance
     */

    /**
     * START Block height
     */

    /**
     * Get the block height
     * @returns _walletData { promise }
     * @private
     */
    Wallet.prototype._getBlockHeight = function() {
        var self = this;

        return self._getBlockHeightFromStorage()
            .then(self._getBlockHeightFromSdk.bind(self))
            .then(self._setBlockHeightToStorage.bind(self))
            .then(self._updateBlockHeightInWalletDataObject.bind(self), self._errorHandler);
    };

    /**
     * Get the block height document from the storage
     * @returns balanceDoc { promise } {{ _id: string, height: string|null }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromStorage = function() {
        var self = this;

        return self._$q.when(self._walletStore.get(self._getUniqueId("block-height")))
            .then(self._getBlockHeightFromStorageSuccessHandler.bind(self), self._getBlockHeightFromStorageErrorHandler.bind(self));
    };

    /**
     * Get the block height from the storage, the success handler
     * @param blockHeightDoc
     * @return balanceDoc {{ _id: string, height: string }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromStorageSuccessHandler = function(blockHeightDoc) {
        return blockHeightDoc;
    };

    /**
     * Get the block height document from the storage, the error handler
     * @return {{ _id: string, height: null }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromStorageErrorHandler = function() {
        var self = this;

        return {
            _id: self._getUniqueId("block-height"),
            height: null
        };
    };

    /**
     * Get the block height from SDK
     * @param blockHeightDoc {{ _id: string, height: string }}
     * @returns blockHeightDoc { promise } {{ _id: string, height: string }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromSdk = function(blockHeightDoc) {
        var self = this;

        return self._$q.when(self._sdkWallet.sdk.blockLatest())
            .then(self._getBlockHeightFromSdkSuccessHandler.bind(self, blockHeightDoc), self._getBlockHeightFromSdkErrorHandler.bind(self, blockHeightDoc));
    };

    /**
     * Get the block height from the sdk, the success handler
     * @param blockHeightDoc {{ _id: string, height: string }}
     * @param result { object }
     * @return {{ _id: string, height: string }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromSdkSuccessHandler = function(blockHeightDoc, result) {
        blockHeightDoc.height = result.height;

        return blockHeightDoc;
    };

    /**
     * Get the block height from the sdk, the error handler
     * @param blockHeightDoc
     * @return blockHeightDoc {{ _id: string, height: string }}
     * @private
     */
    Wallet.prototype._getBlockHeightFromSdkErrorHandler = function(blockHeightDoc) {
        return blockHeightDoc;
    };

    /**
     * Set the block height document to the storage
     * @param blockHeightDoc { object }
     * @returns blockHeightDoc { promise } {{ _id: string, height: string }}
     * @private
     */
    Wallet.prototype._setBlockHeightToStorage = function(blockHeightDoc) {
        var self = this;

        return self._$q.when(self._walletStore.put(blockHeightDoc))
            .then(function() { return blockHeightDoc; });
    };

    /**
     * Update block height in the wallet data object
     * @param blockHeightDoc {{ _id: string, height: string }}
     * @returns _walletData { object }
     * @private
     */
    Wallet.prototype._updateBlockHeightInWalletDataObject = function(blockHeightDoc) {
        var self = this;

        self._walletData.blockHeight = blockHeightDoc.height;

        return self._walletData;
    };

    /**
     * END Block height
     */

    /**
     * START Last block hash
     */

    /**
     * Get the last block hash document from the storage
     * @return { promise } {{ _id: string, hash: string|null }}
     * @private
     */
    Wallet.prototype._getLastBlockHashFromStorage = function() {
        var self = this;

        return self._walletStore.get(self._getUniqueId("last-block-hash"))
            .then(self._getLastBlockHashFromStorageSuccessHandler.bind(self), self._getLastBlockHashFromStorageErrorHandler.bind(self));
    };

    /**
     * Get the last block hash document from the storage, the success handler
     * @param lastBlockHashDoc
     * @return lastBlockHashDoc {{ _id: string, hash: string }}
     * @private
     */
    Wallet.prototype._getLastBlockHashFromStorageSuccessHandler = function(lastBlockHashDoc) {
        return lastBlockHashDoc;
    };

    /**
     * Get the last block hash document from the storage, the error handler
     * @return {{ _id: string, hash: null }}
     * @private
     */
    Wallet.prototype._getLastBlockHashFromStorageErrorHandler = function() {
        var self = this;

        return {
            _id: self._getUniqueId("last-block-hash"),
            hash: null
        };
    };

    /**
     * Set the last block hash to the storage
     * @param lastBlockHashDoc
     * @return lastBlockHashDoc { promise } {{ _id: string, hash: string }}
     * @private
     */
    Wallet.prototype._setLastBlockHashToStorage = function(lastBlockHashDoc) {
        var self = this;

        return self._walletStore.put(lastBlockHashDoc)
            .then(function() { return lastBlockHashDoc; });
    };

    /**
     * END Last block hash
     */

    /**
     * START Transactions
     */

    /**
     * Get transactions
     * @returns { promise }
     */
    Wallet.prototype._getTransactions = function() {
        var self = this;

        return self._$q.when(self._getTransactionsHistoryFromStorage())
            .then(self._prepareTransactionsList.bind(self))
            .then(self._processTransactionDocs.bind(self), self._errorHandler)
            .then(self._updateTransactionsList.bind(self));
    };

    /**
     * Poll transactions
     * @return { promise }
     */
    Wallet.prototype._pollTransactions = function() {
        var self = this;

        return self._$q.when(self._getLastBlockHashFromStorage())
            // We reject the promise if we do not have new transactions and handle it in '_pollTransactionsCatchHandler'
            // TODO review logic with reject, replace it with done
            .then(self._getTransactionsHistoryFromStorageAndTransactionsFromSdk.bind(self))
            .then(self._processTransactionsAndGetBalance.bind(self))
            .then(self._setLastBlockHashToStorageAndTransactionHistoryToStorage.bind(self))
            .then(self._addNewTransactionsToList.bind(self))
            .catch(self._pollTransactionsCatchHandler.bind(self));
    };

    /**
     * Get the transactions history document from the storage
     * @return { promise } {{ _id: string, confirmed: Array, unconfirmed: Array }}
     * @private
     */
    Wallet.prototype._getTransactionsHistoryFromStorage = function() {
        var self = this;

        return self._walletStore.get(self._getUniqueId("transactions-history"))
            .then(self._getTransactionsHistoryFromStorageSuccessHandler.bind(self), self._getTransactionsHistoryFromStorageErrorHandler.bind(self));
    };

    /**
     * Get the transactions history document from the storage, the success handler
     * @param transactionsHistoryDoc
     * @return transactionsHistoryDoc {{ _id: string, confirmed: Array, unconfirmed: Array }}
     * @private
     */
    Wallet.prototype._getTransactionsHistoryFromStorageSuccessHandler = function(transactionsHistoryDoc) {
        return transactionsHistoryDoc;
    };

    /**
     * Get the transaction history document from the storage, the error handler
     * @return {{ _id: string, confirmed: Array, unconfirmed: Array }}
     * @private
     */
    Wallet.prototype._getTransactionsHistoryFromStorageErrorHandler = function() {
        var self = this;

        return {
            _id: self._getUniqueId("transactions-history"),
            confirmed: [],
            unconfirmed: []
        }
    };

    /**
     * Set the transaction history document to the storage
     * @param transactionsHistoryDoc
     * @return transactionsHistoryDoc { promise } {{ _id: string, confirmed: Array, unconfirmed: Array }}
     * @private
     */
    Wallet.prototype._setTransactionHistoryToStorage = function(transactionsHistoryDoc) {
        var self = this;

        return self._walletStore.put(transactionsHistoryDoc)
            .then(function() { return transactionsHistoryDoc; });
    };

    /**
     * Set the transaction document to the storage
     * @param transactionDoc
     * @return transactionDoc { promise } {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._setTransactionToStorage = function(transactionDoc) {
        var self = this;

        return self._$q.when(self._walletStore.put(transactionDoc))
            .then(function() { return transactionDoc; });
    };

    /**
     * Get the transactions from the sdk
     * @return { promise } {{ lastBlockHash: string, data: Array }}
     * @private
     */
    Wallet.prototype._getTransactionsFromSdk = function(lastBlockHash) {
        var self = this;

        var params = {
            sort_dir: 'desc',
            lastBlockHash: lastBlockHash
        };

        return self._$q.when(self._sdkWallet.transactions(params))
            .then(self._getTransactionsFromSdkSuccessHandler.bind(self, lastBlockHash));
    };

    /**
     * Get the transactions from the sdk, the success handler
     * @return { promise } {{ lastBlockHash: string, data: Array }}
     * @private
     */
    Wallet.prototype._getTransactionsFromSdkSuccessHandler = function(lastBlockHash, results) {
        var self = this;

        // TODO review, remove "reject"
        if (!results.data.length) {
            // no new transactions...break out
            return self._$q.reject(new blocktrail.WalletPollError('NO_TX'));
        }

        return results;
    };

    /**
     * Get the transaction history from the storage and the transactions from the sdk
     * @param lastBlockHashDoc
     * @return { promise } [lastBlockHashDoc, transactionHistoryDoc, transactionsFromSdkResult]
     * @private
     */
    Wallet.prototype._getTransactionsHistoryFromStorageAndTransactionsFromSdk = function (lastBlockHashDoc) {
        var self = this;

        return self._$q.all([
            self._$q.when(lastBlockHashDoc),
            self._getTransactionsHistoryFromStorage(),
            self._getTransactionsFromSdk(lastBlockHashDoc.hash)
        ]);
    };

    /**
     * Process transactions and get balance
     * @return { promise } {{ newTransactions: array, confirmedTransactions: array, lastBlockHashDoc: object, transactionHistoryDoc: object }}
     * @private
     */
    Wallet.prototype._processTransactionsAndGetBalance = function(data) {
        var self = this;

        return self._$q.all([self._processTransactions(data), self._getBalance()])
            .then(function(results) {
                return results[0];
            });
    };

    /**
     * Process transactions
     * @param data [lastBlockHashDoc, transactionsHistoryHistory, transactionsFromSdkResult]
     * @return { promise } {{ newTransactions: array, confirmedTransactions: array, lastBlockHashDoc: object, transactionHistoryDoc: object }}
     * @private
     */
    Wallet.prototype._processTransactions = function(data) {
        var self = this;

        var lastBlockHashDoc = data[0];
        var transactionHistoryDoc = data[1];
        var transactions = data[2].data;

        var oldUnconfirmed = transactionHistoryDoc.unconfirmed;
        var newTransactions = [];
        var confirmedTransactions = [];
        var promises = [];

        // Update last block hash doc
        lastBlockHashDoc.hash = data[2].lastBlockHash;

        // Clear old list of unconfirmed transactions to update against current mempool
        transactionHistoryDoc.unconfirmed = [];

        // Add new transactions to the confirmed/unconfirmed historyDoc lists
        transactions.forEach(function(transaction) {
            if (transaction.block_height) {
                // Check if previously saved as unconfirmed and update is
                if (oldUnconfirmed.indexOf(transaction.hash) !== -1) {
                    debugger;

                    transactionHistoryDoc.confirmed.unshift(transaction.hash);
                    confirmedTransactions.push(transaction);
                    promises.push(self._updateTransaction(transaction));
                    // Add new confirmed transaction to the list
                } else if (transactionHistoryDoc.confirmed.indexOf(transaction.hash) === -1) {
                    transactionHistoryDoc.confirmed.unshift(transaction.hash);
                    newTransactions.push(transaction);
                    promises.push(self._addTransaction(transaction));
                }
            } else {
                // Add to unconfirmed list
                if (transactionHistoryDoc.unconfirmed.indexOf(transaction.hash) === -1) {
                    transactionHistoryDoc.unconfirmed.unshift(transaction.hash);
                }

                // Check old unconfirmed to see if it's new
                if(oldUnconfirmed.indexOf(transaction.hash) === -1) {
                    newTransactions.push(transaction);
                    promises.push(self._addTransaction(transaction));
                }
            }
        });

        return self._$q.all(promises)
            .then(function() {
                return {
                    newTransactions: newTransactions,
                    confirmedTransactions: confirmedTransactions,
                    lastBlockHashDoc: lastBlockHashDoc,
                    transactionHistoryDoc: transactionHistoryDoc
                };
            });
    };

    /**
     * Get the transaction document from the storage
     * @return { promise } {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._getTransactionFromStorageByHash = function(transactionHash) {
        var self = this;

        return self._$q.when(self._walletStore.get(self._getUniqueId("transaction", transactionHash)));
    };

    /**
     * Get the transaction document from the storage, the success handler
     * @param transactionDoc
     * @return transactionDoc {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._getTransactionFromStorageByHashSuccessHandler = function(transactionDoc) {
        return transactionDoc;
    };

    /**
     * Get the transaction document from the storage, the error handler
     * @param transaction
     * @return {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._getTransactionFromStorageByHashErrorHandler = function(transaction) {
        var self = this;

        return {
            _id: self._getUniqueId("transaction", transaction.hash),
            data: transaction
        }
    };

    /**
     * Add the new transaction
     * @param transaction
     * @return transactionDoc { promise } {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._addTransaction = function(transaction) {
        var self = this;

        return self._setTransactionToStorage({
            _id: self._getUniqueId("transaction", transaction.hash),
            data: transaction
        });
    };

    /**
     * Update the saved transaction
     * @param transaction
     * @return transactionDoc { promise } {{ _id: string, data: object }}
     * @private
     */
    Wallet.prototype._updateTransaction = function(transaction) {
        var self = this;

        return self._getTransactionFromStorageByHash(transaction.hash)
            .then(self._getTransactionFromStorageByHashSuccessHandler.bind(self), self._getTransactionFromStorageByHashErrorHandler.bind(transaction, self))
            .then(self._updateTransactionDoc.bind(self, transaction))
            .then(self._setTransactionToStorage.bind(self));
    };

    /**
     * Update the transaction document
     * @param transactionData
     * @param transactionDoc
     * @return {*}
     * @private
     */
    Wallet.prototype._updateTransactionDoc = function(transactionData, transactionDoc) {
        transactionDoc.data = transactionData;

        return  transactionDoc;
    };

    /**
     * Reset the pool promise flag
     * @return { boolean }
     * @private
     */
    Wallet.prototype._resetPollPromise = function() {
        var self = this;

        self._pollPromise = null;

        return true;
    };

    /**
     * Set the last block hash and the transactions history to the storage
     * @param data {{ newTransactions: array, confirmedTransactions: array, lastBlockHashDoc: object, transactionHistoryDoc: object }}
     * @return { promise } {{ newTransactions: array, confirmedTransactions: array, lastBlockHashDoc: object, transactionHistoryDoc: object }}
     * @private
     */
    Wallet.prototype._setLastBlockHashToStorageAndTransactionHistoryToStorage = function(data) {
        var self = this;

        return self._$q.all([self._setLastBlockHashToStorage(data.lastBlockHashDoc), self._setTransactionHistoryToStorage(data.transactionHistoryDoc)])
            .then(function() {
                return data.transactionHistoryDoc;
            });
    };

    /**
     * Poll transactions catch handler
     * @param e
     * @private
     */
    Wallet.prototype._pollTransactionsCatchHandler = function(e) {
        var self = this;

        if (e.message === 'NO_TX') {
            return self._$q.when(true);
        } else if (e.message === 'ORPHAN') {
            // ORPHAN means we need to resync (completely)
            return self._resetWalletData()
                .then(function () {
                    var self = this;

                    return self._$q.all([self._getBalance(), self._getBlockHeight(), self._pollTransactions()]);
                });
        } else {
            self._errorHandler(e);
        }
    };

    /**
     * Broadcast new and confirmed transactions
     * @param transactionHistoryDoc
     * @return { promise }
     * @private
     */
    Wallet.prototype._addNewTransactionsToList = function(transactionHistoryDoc) {
        var self = this;

        return self._$q.when(self._prepareTransactionsList(transactionHistoryDoc))
            .then(self._processTransactionDocs.bind(self), self._errorHandler)
            .then(self._updateTransactionsList.bind(self));
    };

    /**
     * Prepare transactions list
     * @param transactionHistoryDoc
     * @returns { promise }
     * @private
     */
    Wallet.prototype._prepareTransactionsList = function(transactionHistoryDoc) {
        var self = this;
        var list = transactionHistoryDoc.unconfirmed.concat(transactionHistoryDoc.confirmed);
        var promises = [];

        list.forEach(function(transactionHash) {
            promises.push(self._getTransactionFromStorageByHash(transactionHash));
        });

        return self._$q.all(promises);
    };

    /**
     * Process the transaction documents list
     * @param transactionDocs
     * @returns transactionDoc.data { array }
     * @private
     */
    Wallet.prototype._processTransactionDocs = function(transactionDocs) {
        return transactionDocs.map(function(transactionDoc) {
            return transactionDoc.data;
        });
    };

    /**
     * Update the transaction list
     * @param transactions
     * @private
     */
    Wallet.prototype._updateTransactionsList = function(transactions) {
        var self = this;

        // TODO Create a method and call it on new contacts
        return self._extentTransactionsWithContactsAndGlideraData(transactions)
            .then(function() {
                self._walletData.transactions
                    .splice
                    .apply(self._walletData.transactions, [0, self._walletData.transactions.length]
                        .concat(transactions)
                    );

                return self._walletData;
            });
    };

    /**
     * Extent the transactions with contacts data and glidera data
     * TODO Move glidera transactions to the wallet and review this piece of hell
     * @param transactions
     * @private
     */
    Wallet.prototype._extentTransactionsWithContactsAndGlideraData = function(transactions) {
        var self = this;

        return self._settingsService.getSettings()
            .then(function(settings) {
                var promises = [];
                var completeGlideraTransactions = settings.glideraTransactions.filter(function (item) {
                    return !!item.transactionHash || item.status === "COMPLETE";
                });

                transactions.forEach(function(transaction) {
                    // Add contact data
                    if(transaction.contacts.length) {
                        // Take the first contact from contacts list
                        promises.push(self._addContactToTransaction(transaction, transaction.contacts[0]))
                    } else {
                        transaction.contact = null;
                    }

                    var updateGlideraTransactions = false;

                    // Add Glidera data
                    if (completeGlideraTransactions.length) {
                        completeGlideraTransactions.forEach(function(glideraTxInfo) {
                            // check if transaction hash matches
                            var isTxhash = glideraTxInfo.transactionHash && glideraTxInfo.transactionHash === transaction.hash;
                            // check if address matches
                            var isAddr = glideraTxInfo.address && transaction.self_addresses.indexOf(glideraTxInfo.address) !== -1;

                            // if address matches but there's no transactionHash then we 'fix' it
                            //  sometimes this happens when the glidera API is slow to update
                            if (!glideraTxInfo.transactionHash && isAddr) {
                                glideraTxInfo.transactionHash = transaction.hash;
                                isTxhash = true;
                            }

                            // add metadata if it's a match
                            if (isTxhash) {
                                transaction.buybtc = {
                                    broker: 'glidera',
                                    qty: glideraTxInfo.qty,
                                    currency: glideraTxInfo.currency,
                                    price: glideraTxInfo.price
                                };

                                // set the walletIdentifier to our wallet if it wasn't already set (old TXs)
                                if (!glideraTxInfo.walletIdentifier) {
                                    glideraTxInfo.walletIdentifier = self._sdkWallet.identifier;
                                    updateGlideraTransactions = true;
                                }
                            }
                        });
                    }

                    // trigger update if we modified data
                    if (updateGlideraTransactions) {
                        return self._settingsService.updateGlideraTransactions(settings.glideraTransactions);
                    }
                });

                return self._$q.all(promises)
                    .then(function () {
                        return transactions;
                    });

            });
    };

    /**
     * Add contact to transaction
     * @param transaction
     * @param contactHash
     * @private
     */
    Wallet.prototype._addContactToTransaction = function(transaction, contactHash) {
        var self = this;

        return self._contactsService.findByHash(contactHash)
            .then(function(contact) {
                if(contact) {
                    transaction.contact = contact;
                } else {
                    transaction.contact = null;
                }
            });
    };

    /**
     * END Transactions
     */

    /**
     * Get a unique id
     * @param type { string }
     * @param id { string= } only for the transactions
     * @return { string }
     * @private
     */
    Wallet.prototype._getUniqueId = function(type, id) {
        var idWithPrefix;
        var self = this;

        switch (type) {
            // +++
            case "balance":
                idWithPrefix = self._sdkWallet.identifier + ":bc";
                break;
            // +++
            case "block-height":
                idWithPrefix = self._sdkWallet.identifier + ":bh";
                break;
            case "addresses":
                idWithPrefix = self._sdkWallet.identifier + ":ad";
                break;
            // +++
            case "transaction":
                if(!id) {
                    self._errorHandler({
                        message: "method _addIdPrefix, id for transaction should be defined"
                    });
                }
                idWithPrefix = self._sdkWallet.identifier + ":tx:" + id;
                break;
            // +++
            case "transactions-history":
                idWithPrefix = self._sdkWallet.identifier + ":th";
                break;
            // +++
            case "last-block-hash":
                idWithPrefix = self._sdkWallet.identifier + ":lh";
                break;
            default:
                self._errorHandler({
                    message: "method _addIdPrefix, type of prefix should be defined"
                });
        }

        return idWithPrefix;
    };

    /**
     * Error handler
     * @param e {error}
     * @private
     */
    Wallet.prototype._errorHandler = function (e) {
        throw new Error("Class Wallet : " + e.message ? e.message : "");
    };

    /**
     *
     * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
     * @@@@     @@@@@@@@@@@@@@@@@@@@@@@     @@@@
     * @@@@@@@@@@@@@@  @@@@  @@@  @@@@@@@@@@@@@@
     * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
     *
     * TODO Review later
     *
     */
    Wallet.prototype.validateAddress = function(address) {
        var self = this;

        return self._$q.when(address)
            .then(function(address) {
                var addr, err;

                try {
                    addr = self._bitcoinJS.address.fromBase58Check(address);
                    if (addr.version !== self._sdkWallet.sdk.network.pubKeyHash && addr.version !== self._sdkWallet.sdk.network.scriptHash) {
                        err = new blocktrail.InvalidAddressError("Invalid network");
                    }
                } catch (_err) {
                    err = _err;
                }

                if (!addr || err) {
                    throw new blocktrail.InvalidAddressError("Invalid address [" + address + "]" + (err ? " (" + err.message + ")" : ""));
                }

                return address;
            });
    };

    Wallet.prototype.unlockWithPassword = function(password) {
        var self = this;

        return self._$q.when(self._sdkWallet)
            .then(function(wallet) {
                return wallet.unlock({
                    password: password
                })
                    .then(function() {
                        return wallet;
                    });
            });
    };

    Wallet.prototype.refillOfflineAddresses = function(max) {
        var self = this;

        if (self.isRefilling) {
            // $log.debug('refill in progress');
            return self.addressRefillPromise;
        }

        self.isRefilling = true;

        return self.addressRefillPromise = self._walletStore.get(self._getUniqueId("addresses"))
            .then(function(addressesDoc) {
                return addressesDoc;
            }, function(e) {
                return {
                    _id: self._getUniqueId("addresses"),
                    available: []
                }
            })
            .then(function(addressesDoc) {
                var refill = self._amountOfOfflineAddresses - addressesDoc.available.length;
                var cappedRefill = Math.min(refill, max, 5);

                // $log.debug('refill address by ' + cappedRefill);
                if (cappedRefill > 0) {
                    return Q.all(repeat(cappedRefill, function(i) {
                        return self._sdkWallet.getNewAddress().then(function(result) {
                            addressesDoc.available.push(result[0]);
                        });
                    })).then(function() {
                        // fetch doc again, might have been modified!
                        self._walletStore.get(self._getUniqueId("addresses"))
                            .then(function(r) {
                                return r;
                            }, function(e) { return {
                                _id: self._getUniqueId("addresses"),
                                available: []}
                            })
                            .then(function(_addressesDoc) {
                                _addressesDoc.available = _addressesDoc.available.concat(addressesDoc.available).unique();
                                return self._walletStore.put(_addressesDoc);
                            })
                            .then(function() {
                                self.isRefilling = false;
                                return true;
                            });
                    });
                } else {
                    self.isRefilling = false;
                    return true;
                }
            })
            .catch(function(err) {
                self.isRefilling = false;
                return self._$q.reject(e);
            });
    };

    Wallet.prototype.getNewAddress = function() {
        var self = this;

        return self.getNewOfflineAddress().then(
            function(address) {
                return address;
            },
            function(e) {
                return self._sdkWallet.getNewAddress().then(function(result) {
                    return result[0];
                });
            }
        );
    };

    Wallet.prototype.getNewOfflineAddress = function() {
        var self = this;

        return self._walletStore.get(self._getUniqueId("addresses"))
            .then(function(addressesDoc) {
                    var address = addressesDoc.available.shift();
                    if (!address) {
                        // $log.debug('no more offline address');
                        return self._$q.reject('no more offline addresses');
                    } else {
                        // $log.debug('offline address', address);
                        return self._walletStore.put(addressesDoc)
                            .then(function() {
                                return address;
                            });
                    }
                },
                function(e) {
                    // $log.error("no offline addresses available yet. " + e);
                    throw e;
                }
            );
    };

})();
