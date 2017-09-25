(function () {
    "use strict";

    angular.module('blocktrail.setup')
        .factory('newAccountFormService', function($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService, trackingService, powtchaService) {

            return new NewAccountFormService($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService, trackingService, powtchaService);
        }
    );

    function NewAccountFormService($http, $q, _, cryptoJS, navigator, CONFIG, launchService, setupService, sdkService, trackingService, powtchaService) {
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
        self._powtchaService = powtchaService;
    }

    /**
     * Register
     * @param data
     * @param powtchaPromise
     * @return { promise }
     */
    NewAccountFormService.prototype.register = function(data, powtchaPromise) {
        var self = this;

        var postData = {
            username: null,
            email: data.email,
            password: self._cryptoJS.SHA512(data.password).toString(),
            password_score: data.passwordCheck && data.passwordCheck.score || 0,
            platform: "Web",
            version: self._CONFIG.VERSION || self._CONFIG.VERSION_REV,
            device_name: self._navigator.userAgent || "Unknown Browser",
            super_secret: self._CONFIG.SUPER_SECRET || null,
            powtcha: null,
            browser_fingerprint: null
        };

        var url = self._CONFIG.API_URL + "/v1/" + data.networkType + "/mywallet/register";

        return powtchaPromise
            .then(function(powtcha) {
                return powtcha.findNonce()
                    .then(function(powtchaResult) {
                        postData.powtcha = powtchaResult;
                        return postData;
                    });
            })
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
                    .then(self._storeAccountInfo.bind(self));
            })
            .catch(self._errorHandler.bind(self));
    };

    /**
     * Store the account info
     * @param response
     * @return { promise }
     * @private
     */
    NewAccountFormService.prototype._storeAccountInfo = function(response) {
        var self = this;

        var accountInfo = self._lodash.merge({}, response.data);

        return self._launchService.storeAccountInfo(accountInfo)
            .then(function() {
                return self._setupService.setUserInfo({
                    username: response.data.username,
                    displayName: response.data.username,
                    email: response.data.email
                });
            })
            .then(function() {
                return response.data;
            })
    };

    /**
     * Error handler
     * @param response
     * @private
     */
    NewAccountFormService.prototype._errorHandler = function(response) {
        var error;

        if (response.data.msg.toLowerCase().match(/username exists/)) {
            error = "MSG_USERNAME_TAKEN";
        } else if (response.data.msg.toLowerCase().match(/already in use/)) {
            error = "MSG_EMAIL_TAKEN";
        } else {
            error = response.data.msg;
        }

        return this._$q.reject(error);
    };
})();
