(function () {
    "use strict";

    angular.module("blocktrail.core")
        .filter("satoshiToCurrency", satoshiToCurrency);

    function satoshiToCurrency($rootScope, Currencies, CONFIG) {
        var coin = 100000000;
        var precision = 8;

        return function(input, currency, currencyRates, fractionSize, useMarkup, hideCurrencyDisplay) {
            // normalize
            currency = currency.toUpperCase();

            var btc = parseFloat((input/ coin).toFixed(precision));
            var localValue;
            var symbol;
            var currencyDisplay;

            if (typeof fractionSize === "undefined") {
                fractionSize = 2;
            } else {
                fractionSize = parseInt(fractionSize);
            }

            // use global prices
            if (typeof currencyRates === "undefined") {
                currencyRates = $rootScope.bitcoinPrices;
            }

            if (typeof currencyRates[currency] !== "undefined") {
                localValue = (btc * currencyRates[currency]).toFixed(fractionSize);
            } else {
                localValue = (0).toFixed(fractionSize);
            }

            if (typeof Currencies.currencies[currency] === "undefined") {
                symbol = input;
            } else {
                symbol = Currencies.currencies[currency].symbol || currency;
            }

            if (currency === "BTC") {
                currencyDisplay = useMarkup ? ('<span class="disp">' + CONFIG.TICKER + '</span>') : (" " + CONFIG.TICKER);
                return hideCurrencyDisplay ? btc.toFixed(fractionSize) : btc.toFixed(fractionSize) + currencyDisplay;
            } else {
                currencyDisplay = useMarkup ? ('<span class="disp">' + symbol + '</span>') : symbol;
                return hideCurrencyDisplay ? localValue : currencyDisplay + localValue;
            }
        };
    }

})();
