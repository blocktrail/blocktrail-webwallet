(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('accountSecurityService', AccountSecurityService);

    function AccountSecurityService(CONFIG, $http) {

        function verifyEmail(token) {
            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/security/verify-email", {verify_token: token})
        }

        return {
            verifyEmail: verifyEmail
        };
    }
})();
