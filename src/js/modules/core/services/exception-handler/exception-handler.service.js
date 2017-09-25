(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('$exceptionHandler', function($log) {
            return function(exception, cause) {
                if(!!exception.silentException) {
                    return exception;
                } else {
                    $log.error.apply($log, arguments);
                }
            };
        });
})();
