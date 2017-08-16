(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('formSettingsService', function ($rootScope, $q, $http, $translate, sdkService, cryptoJS, launchService, settingsService, Currencies, blocktrailLocalisation) {
            return new FormSettingsService($rootScope, $q, $http, $translate, sdkService, cryptoJS, launchService, settingsService, Currencies, blocktrailLocalisation);
        });

    function FormSettingsService($rootScope, $q, $http, $translate, sdk, cryptoJS, launchService, settingsService, Currencies, blocktrailLocalisation) {
        var self = this;

        // TODO Remove $rootScope
        self._$rootScope = $rootScope;
        self._$q = $q;
        self._$http = $http;
        self._$translate = $translate;
        self._sdk = sdk;
        self._cryptoJS = cryptoJS;
        self._launchService = launchService;
        self._settingsService = settingsService;
        self._currencyService = Currencies;
        self._blocktrailLocalisationService = blocktrailLocalisation;
    }

    /**
     * Fetch data
     *
     * @returns {promise}
     */
    FormSettingsService.prototype.fetchData = function () {
        var self = this;

        var promiseSettings = self._settingsService.getSettings();
        var promiseAccountInfo = self._launchService.getAccountInfo();
        // TODO remove from $rootScope
        var promiseLanguages = self._$rootScope.fetchExtraLanguages;

        return self._$q.all([promiseSettings, promiseAccountInfo, promiseLanguages])
            .then(function (data) {
                var settings = data[0];

                return {
                    settings: {
                        username: settings.username || "",
                        email: settings.email,
                        localCurrency: settings.localCurrency,
                        language: self._$translate.use(),
                        receiveNewsletter: settings.receiveNewsletter,
                        profilePic: settings.profilePic
                    },
                    isEnabled2faToggle: data[1].requires2FA || false,
                    currencies: self.getCurrencies(),
                    languages: self.getLanguages()
                }
            });
    };

    /**
     * Save data
     *
     * @param obj
     * @returns {promise}
     */
    FormSettingsService.prototype.saveData = function (obj) {
        var self = this;

        return self._settingsService.updateSettingsUp(obj);
    };

    /**
     * Get currencies
     *
     * @returns {array} currency objects
     */
    FormSettingsService.prototype.getCurrencies = function() {
        var self = this;

        return self._currencyService.getFiatCurrencies();
    };

    /**
     * Get languages
     *
     * @returns {array} language objects
     */
    FormSettingsService.prototype.getLanguages = function() {
        var self = this;

        return self._blocktrailLocalisationService
            .getLanguages()
            .map(function(language) {
                var name = self._blocktrailLocalisationService.languageName(language);
                return name ? { code: language, name: name } : null;
        }).clean();
    };

    /**
     * Setup 2FA
     *
     * @param password {string}
     * @returns {promise}
     */
    FormSettingsService.prototype.sdkSetup2FA = function(password) {
        var self = this;

        return self._$q.when(self._getSdk())
            .then(function(sdk) {
                return sdk.setup2FA(self._cryptoJS.SHA512(password).toString());
            });
    };

    /**
     * Enable 2FA
     *
     * @param twoFactorToken {string}
     * @returns {promise}
     */
    FormSettingsService.prototype.sdkEnable2FA = function(twoFactorToken) {
        var self = this;

        return self._$q.when(self._getSdk())
            .then(function(sdk) {
                return sdk.enable2FA(twoFactorToken);
            });
    };

    /**
     * Disable 2FA
     *
     * @param twoFactorToken {string}
     * @returns {promise}
     */
    FormSettingsService.prototype.sdkDisable2FA = function(twoFactorToken) {
        var self = this;

        return self._$q.when(self._getSdk())
            .then(function(sdk) {
                return sdk.disable2FA(twoFactorToken);
            });
    };

    /**
     * Update launch service 2FA
     *
     * @param flag {boolean}
     * @returns {promise}
     */
    FormSettingsService.prototype.updateLaunchService2FA = function(flag) {
        var self = this;

        return self._$q.when(self._getAccountInfo())
            .then(function(accountInfo) {
                accountInfo.requires2FA = flag;

                return self._launchService.storeAccountInfo(accountInfo);
            });
    };

    /**
     * Get sdk
     *
     * @returns sdk {promise}
     * @private
     */
    FormSettingsService.prototype._getSdk = function () {
        var self = this;

        return self._sdk.sdk();
    };

    /**
     * Get account info
     *
     * @returns accountInfo {promise}
     * @private
     */
    FormSettingsService.prototype._getAccountInfo = function () {
        var self = this;

        return self._launchService.getAccountInfo();
    };

})();
