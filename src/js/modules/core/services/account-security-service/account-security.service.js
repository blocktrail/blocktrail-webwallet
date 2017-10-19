(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

    function AccountSecurityService(CONFIG, settingsService, $http) {


        function verifyEmail(token) {
            var settings = settingsService.getReadOnlySettingsData();
            // TODO: 'verified_email' is not there ....
            console.log(settings);

            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email",
                { verify_token: token }
            );
        }

        function changeEmail(newEmailAddress) {
            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/change-email",
                { new_email_address: newEmailAddress }
            );
        }

        return {
            verifyEmail: verifyEmail,
            changeEmail: changeEmail
        };
    }
})();
