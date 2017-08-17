(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('walletsManagerService', function($q, $state, sdkService, walletService) {
            return new WalletsManagerService($q, $state, sdkService, walletService)
        });

    function WalletsManagerService($q, $state, sdkService, walletService) {
        var self = this;

        self._$q = $q;
        self._$state = $state;
        self._sdk = sdkService;
        self._walletService = walletService;

        self._walletsList = null;
        self._activeWallet = null;


        self._activeWalletId = null;

    }


    WalletsManagerService.prototype.fetchWallets = function() {
        var self = this;
        // TODO sync
        return self._$q.when(self._sdk.sdk())
            .then(function (sdk) {
                return sdk.allWallets({mywallet: 1, limit: 200})
                    .then(function(resp) {
                        self._walletsList = resp.data;

                        return self._walletsList;
                    });
            });
    };

    WalletsManagerService.prototype.setActiveWalletById = function(id) {
        var self = this;

        // TODO check on wallets;

        if(!id && self._activeWalletId) {
            id = self._activeWalletId;
        } else if(!id && !self._activeWalletId) {
            id = self._walletsList[0]["identifier"];
        }

        return self._setActiveWalletById(id);

    };

    WalletsManagerService.prototype._setActiveWalletById = function(id) {
        var self = this;

        return self._walletService.initWallet(id)
            .then(function(wallet) {
                self._activeWallet = wallet;
                self._activeWalletId = id;

                return self._activeWallet;
            });
    };

    WalletsManagerService.prototype.getActiveWallet = function() {
        var self = this;

        return self._activeWallet;
    };

})();