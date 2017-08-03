(function () {
    "use strict";

    angular.module("blocktrail.core")
        .filter("toCurrencyTicker", toCurrencySymbol);

    function toCurrencySymbol(Currencies, CONFIG) {
        return function(input) {
            if (typeof Currencies.currencies[input] === "undefined") {
                if (input === 'BTC') {
                    return CONFIG.TICKER;
                }
                return input;
            } else {
                return Currencies.currencies[input].ticker || Currencies.currencies[input].code || input;
            }
        };
    }

})();
