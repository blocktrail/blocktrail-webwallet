(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('powtchaService', PowtchaService);

    function PowtchaService($http, CONFIG, powtcha) {

        function fetchPoWtcha() {
            return $http.get(CONFIG.API_URL + "/v1/mywallet/powtcha").then(function(result) {
                return result.data;
            });
        }

        function newPoWtcha() {
            return fetchPoWtcha().then(function(result) {
                var _powtcha = new powtcha.PoWtcha({
                    salt: powtcha.Buffer.from(result.salt, 'hex'),
                    target: result.target
                });

                return _powtcha;
            });
        }

        return {
            newPoWtcha: newPoWtcha
        };
    }

})();
