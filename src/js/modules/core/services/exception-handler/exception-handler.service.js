(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('$exceptionHandler', function() {
            return function(exception, cause) {
                if (exception && cause) {
                    $log.warn(exception, cause);
                } else {
                    return exception;
                }
            };
        });
})();
