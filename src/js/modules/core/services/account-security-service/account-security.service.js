(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

    function AccountSecurityService(CONFIG, settingsService, $http, storageService, launchService, $q) {

        var dataStoreId = 'account-security';
        var storage = storageService.db('account-security');

        function setInfo(newData) {
            return $q.when(storage.get('account-security'))
                .then(function(doc) { return doc; }, function() { return {_id: dataStoreId}; })
                .then(function(doc) {
                    angular.forEach(newData, function(value, key) {
                        doc[key] = newData[key];
                    });

                    return storage.put(doc).then(function() {
                        return true;
                    });
                });
        };

        function getInfo() {
            return $q.when(storage.get('account-security'))
                .then(function(doc) { return doc; }, function() { return {_id: dataStoreId}; });
        }

        function getSecurityScore() {

            var settings = settingsService.getReadOnlySettingsData();

            return getInfo().then(function(info) {

                var score = 0.35 * settings.verifiedEmail + 0.35 * (info.passwordScore / 4);

                return launchService.getAccountInfo().then(function (accountInfo) {
                    if (accountInfo.requires2FA) {
                        score += 0.3 * accountInfo.requires2FA
                    }

                    console.log('SCORE', score, {
                        pwscore: info.passwordScore,
                        requ2fa: accountInfo.requires2FA,
                        emailver: settings.verifiedEmail
                    });

                    return score * 100;
                });
            });
        }

        function verifyEmail(token) {
            var settings = settingsService.getReadOnlySettingsData();
            console.log(settings);

            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email",
                { verify_token: token }
            );
        }

        return {
            setInfo: setInfo,
            getInfo: getInfo,
            verifyEmail: verifyEmail,
            getSecurityScore: getSecurityScore
        };
    }
})();
