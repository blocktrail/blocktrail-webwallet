(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

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

        function updateSecurityScore() {
            var settings = settingsService.getReadOnlySettingsData();
            var score = 0.35 * settings.verifiedEmail + 0.35 * (settings.passwordScore / 4);

            return launchService.getAccountInfo().then(function (accountInfo) {
                if (accountInfo.requires2FA) {
                    score += 0.3 * accountInfo.requires2FA
                }

                self._accountSecurityInfo.score = score * 100;
                self._accountSecurityInfo.twoFA = !!accountInfo.requires2FA;
                self._accountSecurityInfo.passwordScore = settings.passwordScore;
                self._accountSecurityInfo.verifiedEmail = settings.verifiedEmail;

                return true;
            });
        }

        function getSecurityScore() {
            return self._readonlyAccountSecurityInfo;
        }

        function verifyEmail(token) {
            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email",
                {verify_token: token}
            );
        }

        return {
            verifyEmail: verifyEmail,
            getSecurityScore: getSecurityScore,
            updateSecurityScore: updateSecurityScore
        };
    }
})();
