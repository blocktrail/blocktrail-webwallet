(function () {
    "use strict";

    angular.module("blocktrail.core")
        .filter("satoshiToCurrency", satoshiToCurrency);

    function satoshiToCurrency($rootScope, Currencies, CONFIG) {
        var coin = 100000000;
        var precision = 8;

        var CURRENCY_DISPLAY_MODE = {
            SHORT: 'short',
            HIDE: 'hide',
            LONG: 'long'
        };

        return function(input, currency, currencyRates, fractionSize, useMarkup, currencyDisplayMode) {
            // normalize

            if (typeof currencyDisplayMode === "undefined" || currencyDisplayMode === false) {
                currencyDisplayMode = CURRENCY_DISPLAY_MODE.SHORT;
            } else if (currencyDisplayMode === true) {
                currencyDisplayMode = CURRENCY_DISPLAY_MODE.HIDE;
            }

            currency = currency.toUpperCase();

            var btc = parseFloat((input/ coin).toFixed(precision));
            var localValue;
            var symbol, long;
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

            if (currency === 'BTC') {
                symbol = CONFIG.TICKER;
                long = CONFIG.TICKER_LONG;
            } else if (typeof Currencies.currencies[currency] === "undefined") {
                symbol = input;
                long = input;
            } else {
                symbol = Currencies.currencies[currency].symbol || currency;
                long = Currencies.currencies[currency].code || currency;
            }

            currencyDisplay = currencyDisplayMode === CURRENCY_DISPLAY_MODE.LONG ? long : symbol;
            currencyDisplay = useMarkup ? ('<span class="disp">' + (currencyDisplay) + '</span>') : (" " + currencyDisplay);

            if (currency === "BTC") {
                return currencyDisplayMode === CURRENCY_DISPLAY_MODE.HIDE ? btc.toFixed(fractionSize) : btc.toFixed(fractionSize) + currencyDisplay;
            } else {
                return currencyDisplayMode === CURRENCY_DISPLAY_MODE.HIDE ? localValue : currencyDisplay + localValue;
            }
        };
    }

})();
