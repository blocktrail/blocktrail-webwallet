(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

    function AccountSecurityService(CONFIG, settingsService, $http, sdkService) {


        function verifyEmail(token) {
            var settings = settingsService.getReadOnlySettingsData();
            // TODO: 'verified_email' is not there ....
            console.log(settings);

            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email",
                { verify_token: token }
            );
        }

        return {
            verifyEmail: verifyEmail
        };
    }
})();
