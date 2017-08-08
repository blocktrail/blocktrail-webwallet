(function () {
    "use strict";

    angular.module("blocktrail.core")
        .filter('filterERS', filterERS);

    function filterERS() {
        function handler(bip39EN, input) {
            var words = input.split(' ');
            input = words[words.length - 1];

            return bip39EN.filter(function (currElement) {
                return currElement.indexOf(input) == 0;
            });
        }

        return handler;
    }
})();
