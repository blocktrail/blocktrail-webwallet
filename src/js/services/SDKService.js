angular.module('blocktrail.wallet').factory(
    'sdkService',
    function($state, launchService, CONFIG) {

        blocktrailSDK.prototype.updateMetadata = function (data, cb) {
            var self = this;

            return self.client.post("/metadata", null, data, cb);
        };

        blocktrailSDK.prototype.syncContacts = function (data, cb) {
            var self = this;

            return self.client.post("/contacts", null, data, cb);
        };

        blocktrailSDK.prototype.getProfile = function () {
            var self = this;

            return self.client.get("/mywallet/profile");
        };

        /**
         * update the server with this user's profile info
         * @param data
         * @param cb
         * @returns {*}
         */
        blocktrailSDK.prototype.syncProfile = function (data) {
            var self = this;

            return self.client.post("/mywallet/profile", null, data);
        };

        blocktrailSDK.prototype.syncSettings = function (data) {
            var self = this;

            return self.client.post("/mywallet/settings", null, data);
        };

        blocktrailSDK.prototype.getSettings = function (data) {
            var self = this;

            return self.client.get("/mywallet/settings");
        };

        /**
         * request a new receiving address for a known contact by their phone number
         *
         * @param phoneHash   string      the hash of a contact's normalised phone number
         * @param cb
         * @returns {*}
         */
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

        blocktrailSDK.prototype.glideraOauth = function (code, redirect_uri, sandbox) {
            var self = this;

            return self.client.post("/mywallet/glidera/oauth", null, {code: code, redirect_uri: redirect_uri, sandbox: sandbox});
        };

        blocktrailSDK.prototype.glideraBuyPrices = function (qty, fiat, sandbox) {
            var self = this;

            return self.client.get("/mywallet/glidera/prices/buy", {qty: qty, fiat: fiat, sandbox: sandbox});
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
            BackupGenerator: blocktrailSDK.BackupGenerator
        };
    }
);
