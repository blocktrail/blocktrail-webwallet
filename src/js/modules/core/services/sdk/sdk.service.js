(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('sdkService', function(blocktrailSDK, CONFIG, networkService) {
            extendBlocktrailSDK(blocktrailSDK);

            /*var accountInfo = null;

            var _sdk = null;
            /!*var sdk = function() {
                // sanity check, should never happen
                if (!accountInfo) {
                    throw new Error("Can't init SDK without accountInfo");
                }

                if (!_sdk) {
                    _sdk = new blocktrailSDK({
                        apiKey: accountInfo.api_key,
                        apiSecret: accountInfo.api_secret,
                        testnet: CONFIG.TESTNET || accountInfo.testnet,
                        host: CONFIG.API_HOST || null,
                        network: CONFIG.NETWORK || "BTC",
                        https: typeof CONFIG.API_HTTPS !== "undefined" ? CONFIG.API_HTTPS : true
                    });
                }

                return _sdk;
            };*!/


            var _accountInfo = null;
            var accountInfo = function() {
                if (!_accountInfo) {
                    _accountInfo = launchService.getAccountInfo().then(
                        function(accountInfo) {
                            return accountInfo;
                        },
                        function(e) {
                            _accountInfo = null;
                            throw e;
                        }
                    );
                }

                return _accountInfo;
            };

            var _sdk = null;

            var sdk = function() {
                if (!_sdk) {
                    _sdk = accountInfo()
                        .then(function(accountInfo) {
                            return new blocktrailSDK({
                                apiKey: accountInfo.api_key,
                                apiSecret: accountInfo.api_secret,
                                testnet: CONFIG.TESTNET || accountInfo.testnet,
                                host: CONFIG.API_HOST || null,
                                network: CONFIG.NETWORK || "BTC",
                                https: typeof CONFIG.API_HTTPS !== "undefined" ? CONFIG.API_HTTPS : true
                            });
                        }, function(e) {
                            console.error('Missing account info for SDK');
                            throw e;
                        })
                        .then(function(sdk) {
                            return sdk;
                        }, function(e) {
                            _sdk = null;
                            throw e;
                        });
                }

                return _sdk;
            };

            return {
                sdk : sdk,
                setAccountInfo: function(_accountInfo) {
                    // accountInfo = _accountInfo;
                    // _sdk = null;
                },
                BackupGenerator: blocktrailSDK.BackupGenerator
            };*/

            return new SdkService(blocktrailSDK, CONFIG, networkService);
        }
    );

    /**
     * TODO here
     * @constructor
     */
    function SdkService(blocktrailSDK, CONFIG) {
        var self = this;

        self._blocktrailSDK = blocktrailSDK;
        self._CONFIG = CONFIG;

        self._accountInfo = null;

        self._sdkList = {
            BTC: null,
            BCC: null
        };

        self._sdkData = {
            networkType: null
        };

        // Read only settings object
        // the object would be shared
        self._readonlyDoc = {
            readonly: true
        };

        angular.forEach(self._sdkData, function(value, key) {
            Object.defineProperty(self._readonlyDoc, key, {
                set: function() {
                    throw new Error("Read only object. Blocktrail core module, SDK service.");
                },
                get: function() {
                    return self._sdkData[key];
                }
            });
        });


        self.activeNetworkType = null;
    }

    SdkService.prototype.getReadOnlySdkData = function() {
        var self = this;

        return self._readonlyDoc;
    };

    SdkService.prototype.setNetworkType = function(networkType) {
        var self = this;

        networkType = networkType.toUpperCase();

        if(typeof self._sdkList[networkType] === 'undefined') {
            throw new Error("Blocktrail core module, sdk service. Network type " + networkType + "is not exist.");
        }

        self._sdkData.networkType = networkType;

        return self._readonlyDoc;
    };


    SdkService.prototype.getSdkByActiveNetwork = function() {
        var self = this;

        if(self._sdkData.networkType === null) {
            throw new Error("Blocktrail core module, sdk service. Network type is not set up");
        }

        return self._sdkList[self._sdkData.networkType];
    };

    SdkService.prototype.getSdkByNetworkType = function(networkType) {
        var self = this;

        networkType = networkType.toUpperCase();

        if(!self._accountInfo) {
            throw new Error("Blocktrail core module, sdk service. Can't get the SDK without accountInfo.");
        }

        if(!self._sdkList[networkType]) {
            throw new Error("Blocktrail core module, sdk service. The type is not exist " + type + ".");
        }

        return self._sdkList[networkType];
    };

    SdkService.prototype.setAccountInfo = function(accountInfo) {
        var self = this;

        self._accountInfo = accountInfo;

        self._initSdkList();
    };

    SdkService.prototype._initSdkList = function() {
        var self = this;

        self._sdkList.BTC = new self._blocktrailSDK({
            apiKey: self._accountInfo ? self._accountInfo.api_key : null,
            apiSecret: self._accountInfo ? self._accountInfo.api_secret : null,
            testnet: self._CONFIG.TESTNET,
            host: self._CONFIG.API_HOST || null,
            network: self._CONFIG.NETWORKS.BTC.NETWORK,
            https: self._CONFIG.API_HTTPS ? self._CONFIG.API_HTTPS : true
        });

        self._sdkList.BCC = new self._blocktrailSDK({
            apiKey: self._accountInfo ? self._accountInfo.api_key : null,
            apiSecret: self._accountInfo ? self._accountInfo.api_secret : null,
            testnet: self._CONFIG.TESTNET,
            host: self._CONFIG.API_HOST || null,
            network: self._CONFIG.NETWORKS.BCC.NETWORK,
            https: self._CONFIG.API_HTTPS ? self._CONFIG.API_HTTPS : true
        });
    };

    function extendBlocktrailSDK(blocktrailSDK) {
        blocktrailSDK.prototype.updateMetadata = function (data, cb) {
            var self = this;

            return self.client.post("/metadata", null, data, cb);
        };

        blocktrailSDK.prototype.getAllWallets = function () {
            var self = this;

            return self.client.get("/mywallet/wallets");
        };

        blocktrailSDK.prototype.syncContacts = function (data, cb) {
            var self = this;

            return self.client.post("/contacts", null, data, cb);
        };

        blocktrailSDK.prototype.getProfile = function () {
            var self = this;

            return self.client.get("/mywallet/profile");
        };

        blocktrailSDK.prototype.syncProfile = function (data) {
            var self = this;

            return self.client.post("/mywallet/profile", null, data);
        };

        blocktrailSDK.prototype.getSettings = function (data) {
            var self = this;

            return self.client.get("/mywallet/settings");
        };

        blocktrailSDK.prototype.syncSettings = function (data) {
            var self = this;

            return self.client.post("/mywallet/settings", null, data);
        };

        blocktrailSDK.prototype.requestContactAddress = function (phoneHash, cb) {
            var self = this;

            return self.client.get("/contact/" + phoneHash + "/new-address", null, false, cb);
        };

        blocktrailSDK.prototype.updatePhone = function (data, cb) {
            var self = this;

            return self.client.post("/mywallet/phone", null, data, cb);
        };

        blocktrailSDK.prototype.removePhone = function (cb) {
            var self = this;

            return self.client.delete("/mywallet/phone", null, null, cb);
        };

        blocktrailSDK.prototype.verifyPhone = function (token, cb) {
            var self = this;

            return self.client.post("/mywallet/phone/verify", null, {token: token}, cb);
        };

        blocktrailSDK.prototype.glideraOauth = function (code, redirect_uri) {
            var self = this;

            return self.client.post("/mywallet/glidera/oauth", {platform: 'web'}, {code: code, redirect_uri: redirect_uri});
        };

        blocktrailSDK.prototype.glideraBuyPrices = function (qty, fiat) {
            var self = this;

            return self.client.get("/mywallet/glidera/prices/buy", {qty: qty, fiat: fiat, platform: 'web'});
        };

        blocktrailSDK.prototype.passwordChange = function (oldPassword, newPassword, encryptedSecret, twoFactorToken, walletsData) {
            var self = this;

            return self.client.post(
                "/mywallet/password-change",
                null,
                {
                    password: oldPassword,
                    new_password: newPassword,
                    encrypted_secret: encryptedSecret,
                    two_factor_token: twoFactorToken,
                    wallets: walletsData
                }
            );
        };

        blocktrailSDK.prototype.setMainMobileWallet = function (identifier, cb) {
            var self = this;

            return self.client.post("/mywallet/main", null, {identifier: identifier}, cb);
        };

        blocktrailSDK.prototype.getSignedBitonicUrl = function (identifier, params) {
            var self = this;

            return self.client.post("/mywallet/" + identifier + "/bitonic/oauth", null, params);
        };

        blocktrailSDK.prototype.setup2FA = function (password, cb) {
            var self = this;

            return self.client.post("/mywallet/2fa/setup", null, {password: password}, cb);
        };

        blocktrailSDK.prototype.enable2FA = function (twoFactorToken, cb) {
            var self = this;

            return self.client.post("/mywallet/2fa/enable", null, {two_factor_token: twoFactorToken}, cb);
        };

        blocktrailSDK.prototype.disable2FA = function (twoFactorToken, cb) {
            var self = this;

            return self.client.post("/mywallet/2fa/disable", null, {two_factor_token: twoFactorToken}, cb);
        };

        blocktrailSDK.prototype.contacts = function (lastSynced, cb) {
            var self = this;

            return self.client.get("/mywallet/contacts", {last_synced: lastSynced}, cb);
        };

        blocktrailSDK.prototype.walletTransaction = function (identifier, txHash) {
            var self = this;

            return self.client.get("/wallet/" + identifier + "/transaction/" + txHash);
        };

        /**
         * send feedback
         * @param identifier
         * @param cb
         * @returns {*}
         */
        blocktrailSDK.prototype.sendFeedback = function (data, cb) {
            var self = this;

            return self.client.post("/mywallet/feedback", null, data, cb);
        };
    }
})();
