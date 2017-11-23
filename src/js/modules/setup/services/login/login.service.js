(function () {
    "use strict";

    angular.module('blocktrail.setup')
        .factory('loginFormService', function($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService,
                                              trackingService, settingsService, passwordStrengthService, accountSecurityService) {

            return new LoginFormService($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService,
                trackingService, settingsService, passwordStrengthService, accountSecurityService);
        }
    );

    /**
     * TODO here
     * @constructor
     */
    function LoginFormService($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService,
                              trackingService, settingsService, passwordStrengthService, accountSecurityService) {
        var self = this;

        self._$http = $http;
        self._$q = $q;
        self._lodash = _;
        self._cryptoJS = cryptoJS;
        self._navigator = navigator;
        self._CONFIG = CONFIG;
        self._launchService = launchService;
        self._setupService = setupService;
        self._sdkService = sdkService;
        self._trackingService = trackingService;
        self._settingsService = settingsService;
        self._accountSecurityService = accountSecurityService;
        self._passwordStrengthService = passwordStrengthService;
    }

    /**
     * Login
     * @param data
     * @return { promise }
     */
    LoginFormService.prototype.login = function(data) {
        var self = this;

        var postData = {
            login: data.login,
            password: self._cryptoJS.SHA512(data.password).toString(),
            platform: "Web",
            version: self._CONFIG.VERSION || self._CONFIG.VERSION_REV,
            two_factor_token: data.twoFactorToken,
            device_name: self._navigator.userAgent || "Unknown Browser",
            browser_fingerprint: null
        };

        return self._passwordStrengthService.checkPassword(data.password, [postData.username, postData.login, "BTC.com", "wallet"])
            .then(function(result) {
                return result;
            }).then(function (result) {

                return self._accountSecurityService.setInfo({
                    metrics: {
                        passwordScore: result.score
                    }
                }).then(function () {
                    var url = self._CONFIG.API_URL + "/v1/" + data.networkType + "/mywallet/enable";

                    return self._$q.when(postData)
                        .then(function(postData) {
                            return self._trackingService.getBrowserFingerprint()
                                .then(function(fingerprint) {
                                    postData.browser_fingerprint = fingerprint.hash;
                                    return postData;
                                }, function() {
                                    // if fingerprint fails we just leave it NULL
                                    return postData;
                                })
                        })
                        .then(function(postData) {
                            return self._$http.post(url, postData)
                                .then(self._decryptSecret.bind(self, data.password))
                                .then(self._storeAccountInfo.bind(self));
                        })
                        .catch(self._errorHandler.bind(self));
                });
            });
    };

    /**
     * Decrypt the secret
     * @param password
     * @param response
     * @return {{responseData, secret: *}}
     * @private
     */
    LoginFormService.prototype._decryptSecret = function(password, response) {
        var self = this;
        var secret = null;

        if(response.data.encrypted_secret) {
            try {
                secret = self._cryptoJS.AES.decrypt(response.data.encrypted_secret, password).toString(self._cryptoJS.enc.Utf8);
            } catch (e) {
                secret = null;
            }

            // TODO: we should have a checksum
            if (!secret || secret.length !== 44) {
                secret = null;
            }
        }

        return {
            responseData: response.data,
            secret: secret
        };
    };

    /**
     * Store the account info
     * @param data
     * @return { promise }
     * @private
     */
    LoginFormService.prototype._storeAccountInfo = function(data) {
        var self = this;

        var accountInfo = self._lodash.merge({}, { secret: data.secret }, data.responseData);

        return self._launchService.storeAccountInfo(accountInfo)
            .then(function() {
                return self._setupService.setUserInfo({
                    username:       data.responseData.username,
                    displayName:    data.responseData.username,
                    email:          data.responseData.email
                });
            })
            .then(function() {
                return data.responseData;
            })
    };

    /**
     * Error handler
     * @param response
     * @private
     */
    LoginFormService.prototype._errorHandler = function(response) {
        var error = {
            type: "MSG_BAD_NETWORK",
            data: null
        };

        if (response.data) {
            var blocktrailSDKError = blocktrailSDK.Request.handleFailure(response.data);

            if (blocktrailSDKError.is_banned) {
                error.type = "BANNED_IP";
                error.data = error.is_banned;
            } else if (blocktrailSDKError.requires_sha512) {
                error.type = "SHA_512";
            } else if (blocktrailSDKError instanceof blocktrailSDK.WalletMissing2FAError) {
                error.type = "2FA_MISSING";
            } else if (blocktrailSDKError instanceof blocktrailSDK.WalletInvalid2FAError
                || (blocktrailSDKError.message && blocktrailSDKError.message.match(/invalid two-factor/))) {
                error.type = "2FA_INVALID";
            } else {
                error.type = "MSG_BAD_LOGIN";
            }
        } else if(error) {
            error.type = "MSG_BAD_LOGIN_UNKNOWN";
            error.data = "" + (error.message || error.msg || error);

            if (error.data === ("" + {})) {
                error.data = null;
            }
        }

        return this._$q.reject(error);
    };
})();
