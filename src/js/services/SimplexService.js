(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('simplexService', function (CONFIG, walletsManagerService, launchService, randomBytesJS) {
            return new SimplexService(CONFIG, walletsManagerService, launchService, randomBytesJS)
        });

    function SimplexService(CONFIG, walletsManagerService, launchService, randomBytesJS) {
        var self = this;

        self._CONFIG = CONFIG;
        self._walletsManagerService = walletsManagerService;
        self._launchService = launchService;
        self._randomBytesJS = randomBytesJS;
    }

    SimplexService.prototype.generateUUID = function () {
        var id = this._randomBytesJS(32).toString('hex');
        return id.slice(0, 8) + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 20)  + '-' + id.slice(20, 32);
    };

    SimplexService.prototype.buyPrices = function(qty, fiat, fiatType, fiatFirst) {
        var self = this;

        var activeWallet = self._walletsManagerService.getActiveWallet();
        var sdk = activeWallet.getSdkWallet().sdk;

        // Default to USD
        if (!fiatType) {
            fiatType = 'USD'
        }

        var postData = {
            qty: qty,
            fiat: fiat,
            fiat_type: fiatType,
            fiat_first: fiatFirst,
            coin_type: activeWallet.getReadOnlyWalletData().networkType.replace('BCC', 'BCH').replace('t', ''), // replace testnet
            platform: 'web'
        };

        return sdk.simplexBuyPrices(postData)
            .then(function(response) {
                if (response.error) {
                    return response;
                }

                // Check if result is for the correct coin
                var coinType = activeWallet.getReadOnlyWalletData().networkType.replace('BCC', 'BCH').replace('t', '') // replace testnet
                if (response.supported_digital_currencies) {
                    if (response.supported_digital_currencies.indexOf(coinType) == -1) {
                        throw new Exception('trying to buy different blockchain coin from wallet');
                    }
                }

                response.qty = response.digital_money.amount;
                response.total = response.fiat_money.total_amount;
                response.fees = response.fiat_money.total_amount - response.fiat_money.base_amount;

                return response;
            });
    };

    SimplexService.prototype.issuePaymentRequest = function (simplexData) {
        var self = this;

        var activeWallet = self._walletsManagerService.getActiveWallet();
        var sdk = activeWallet.getSdkWallet().sdk;

        var postData = {
            qty: simplexData.digital_money.amount,
            fiat: simplexData.fiat_money.total_amount,
            fiat_type: simplexData.fiat_money.currency,
            address: simplexData.address,
            quote_id: simplexData.quote_id,
            order_id: simplexData.order_id,
            payment_id: simplexData.payment_id,
            coin_type: activeWallet.getReadOnlyWalletData().networkType.replace('BCC', 'BCH').replace('t', ''), // replace testnet
            platform: 'web'
        };

        return sdk.simplexPaymentRequest(postData)
    };

    SimplexService.prototype.initRedirect = function (simplexData) {
        var self = this;

        var activeWallet = self._walletsManagerService.getActiveWallet();
        var networkType = activeWallet.getReadOnlyWalletData().networkType;

        return self._launchService.getAccountInfo().then(function (accountInfo) {
            var data = {
                address: simplexData.address,
                identifier: simplexData.identifier,
                qty: simplexData.digital_money.amount,
                fiat: simplexData.fiat_money.total_amount,
                fiat_type: simplexData.fiat_money.currency,
                quote_id: simplexData.quote_id,
                payment_id: simplexData.payment_id,
                coin_type: activeWallet.getReadOnlyWalletData().networkType.replace('BCC', 'BCH').replace('t', ''), // replace testnet
                api_key: accountInfo.api_key,
                platform: 'web'
            };

            var queryString = Object.keys(data)
                .map(function (k) {
                    return encodeURIComponent(k) + '=' + encodeURIComponent(data[k])
                })
                .join('&');

            // TODO: This can be network agnostic, as BUY BTC is only for BTC anyways
            window.open('http://' + self._CONFIG.API_HOST + '/v1/' + networkType + '/mywallet/simplex/payment/forward?' + queryString, '_self')
        });
    };
})();
