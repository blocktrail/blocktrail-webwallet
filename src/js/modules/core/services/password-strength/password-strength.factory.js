(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('passwordStrengthService', function($q) {
            return new PasswordStrengthService($q)
        });

    function PasswordStrengthService($q) {
        var self = this;

        self._$q = $q;
        self._zxcvbn = null;
        self._zxcvbnWait = null;
    }

    PasswordStrengthService.prototype.checkPassword = function(password, extraWords) {
        var self = this;

        if (self._zxcvbn) {
            return self._$q.when()
                .then(function() {
                    return self._zxcvbn(password, extraWords || []);
                })
        } else {
            if (!self._zxcvbnWait) {
                var def = self._$q.defer();

                self._zxcvbnWait = def.promise;

                var waitInterval = setInterval(function() {
                    if (window.zxcvbn) {
                        self._zxcvbn = window.zxcvbn;
                        clearInterval(waitInterval);

                        def.resolve(self._zxcvbn);
                    }
                }, 100);
            }

            return self._zxcvbnWait.then(function() {
                return self._zxcvbn(password, extraWords || []);
            });
        }
    };

})();
