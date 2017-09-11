(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('walletsManagerService', function($q, sdkService, walletService) {
            return new WalletsManagerService($q, sdkService, walletService)
        });

    function WalletsManagerService($q, sdkService, walletService) {
        var self = this;

        self._$q = $q;
        self._sdk = sdkService;
        self._walletService = walletService;

        self._wallets = {};
        self._walletsList = [];
        self._activeWallet = null;
    }

    /**
     * Fetch the wallets list
     */
    WalletsManagerService.prototype.fetchWalletsList = function() {
        var self = this;
        // TODO sync
        return self._$q.when(self._sdk.sdk())
            .then(function (sdk) {
                return sdk.getAllWallets({mywallet: 1, limit: 200})
                    .then(function(resp) {
                        self._walletsList = resp.data;

                        return self._walletsList;
                    });
            });
    };

    /**
     * Get the wallets list
     * @return { Array }
     */
    WalletsManagerService.prototype.getWalletsList = function() {
        var self = this;

        return self._walletsList;
    };

    /**
     * Get the active wallet
     * @return {Wallet|null}
     */
    WalletsManagerService.prototype.getActiveWallet = function() {
        var self = this;

        return self._activeWallet;
    };

    /**
     * Set the active wallet by id
     * @param id
     */
    WalletsManagerService.prototype.setActiveWalletById = function(id) {
        var self = this;
        var promise = null;

        if(!self._isExistingWalletId(id)) {
            id = self._walletsList[0];
        }

        if(self._activeWallet) {
            if(self._activeWallet.getReadOnlyWalletData().identifier !== id) {
                // Disable polling for active wallet and enable polling for new active wallet
                self._activeWallet.disablePolling();

                // Check the wallet in the buffer
                if(self._wallets[id]) {
                    self._wallets[id].enablePolling();
                    // Set a link to the new active wallet
                    self._activeWallet = self._wallets[id];

                    promise = self._$q.when(self._activeWallet);
                } else {
                    // if wallet is not in the buffer we have to initialize it
                    promise = self._setActiveWalletById(id);
                }
            } else {
                promise = self._$q.when(self._activeWallet);
            }
        } else {
            // if active wallet is not exist have to initialize it
            promise = self._setActiveWalletById(id);
        }

        return self._$q.when(promise);
    };

    /**
     * Is existing wallet id
     * @param id
     * @return {boolean}
     * @private
     */
    WalletsManagerService.prototype._isExistingWalletId = function(id) {
        var self = this;

        return !!self._walletsList.filter(function(item) {
            return item.identifier === id;
        });
    };

    /**
     * Set the active wallet by id
     * @param id
     * @return _activeWallet { promise }
     * @private
     */
    WalletsManagerService.prototype._setActiveWalletById = function(id) {
        var self = this;

        console.log('_setActiveWalletById', id);
        var e = new Error();
        console.log(e.stack);

        return self._walletService.initWallet(id)
            .then(function(wallet) {
                // Add wallet to buffer
                self._wallets[wallet.getReadOnlyWalletData().identifier] = wallet;
                // Set a link to the active wallet
                self._activeWallet = self._wallets[wallet.getReadOnlyWalletData().identifier];

                return self._activeWallet;
            });
    };
})();
