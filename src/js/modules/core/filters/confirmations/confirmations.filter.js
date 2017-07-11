(function () {
    "use strict";

    angular.module("blocktrail.core")
        .filter("confirmations", confirmations);

    function confirmations($rootScope) {
        return function(input) {
            if (input) {
                return (parseInt($rootScope.blockHeight) - parseInt(input))+1;
            } else {
                return 0;
            }
        };
    }

})();
