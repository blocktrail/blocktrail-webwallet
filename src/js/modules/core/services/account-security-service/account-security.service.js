(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', function (CONFIG, settingsService, $http, launchService) {
            return new AccountSecurityService(CONFIG, settingsService, $http, launchService);
        });

    function AccountSecurityService(CONFIG, settingsService, $http, launchService) {

        var self = this;

        self._accountSecurityInfo = {
            score: 0,
            twoFA: false,
            passwordScore: 0,
            verifiedEmail: ""
        };

        // Read only account info data object
        // this object would be shared
        self._readonlyAccountSecurityInfo = {
            readonly: true
        };

        angular.forEach(self._accountSecurityInfo, function(value, key) {
            Object.defineProperty(self._readonlyAccountSecurityInfo, key, {
                set: function() {
                    throw new Error("Read only object. Blocktrail core module, account security service.");
                },
                get: function() {
                    return self._accountSecurityInfo[key];
                }
            });
        });

        AccountSecurityService.prototype.updateSecurityScore = function () {
            var settings = settingsService.getReadOnlySettingsData();

            return launchService.getAccountInfo().then(function (accountInfo) {
                // collect security info
                self._accountSecurityInfo.twoFA = !!accountInfo.requires2FA;
                self._accountSecurityInfo.passwordScore = settings.passwordScore === null ? 4 : settings.passwordScore;
                self._accountSecurityInfo.verifiedEmail = settings.verifiedEmail;

                // determine score
                var score = 0.35 * self._accountSecurityInfo.verifiedEmail + 0.35 * (self._accountSecurityInfo.passwordScore / 4);
                if (self._accountSecurityInfo.twoFA) {
                    score += 0.3
                }

                // store score as percentage
                self._accountSecurityInfo.score = score * 100;

                return true;
            });
        };

        AccountSecurityService.prototype.getSecurityScore= function() {
            return self._readonlyAccountSecurityInfo;
        };

        AccountSecurityService.prototype.verifyEmail = function(token) {
            return $http.post(CONFIG.API_URL + "/v1/mywallet/security/verify-email",
                { verify_token: token }
            );
        };
    }
})();
