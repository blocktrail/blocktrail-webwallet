angular.module('blocktrail.wallet').factory(
    'bitonicService',
    function(CONFIG, $log, $q, walletsManagerService, dialogService, $state, $rootScope, $translate, $http,
             $timeout, $interval, settingsService, launchService, sdkService, trackingService) {

        // TODO Review !
        var activeWallet = walletsManagerService.getActiveWallet();
        var encodeOpenURI = function(uri) {
            return uri.replace('#', '%23');
        };

        var buyPrices = function(qty, fiat) {
            return $http({
                    method: 'GET',
                    url: CONFIG.BITONIC_URL + '/api/buy',
                    params: {
                        btc: qty,
                        eur: fiat
                    }
                })
                    .then(function success(response, status, headers) {
                            var data = response.data;
                            data.qty = data.btc;
                            data.total = data.eur;
                            delete data.btc;
                            delete data.eur;
                            $log.log('buyPrices ' + JSON.stringify(response));

                            return data;
                        }, function error(response, status, headers) {
                            $log.error('buyPrices - fetch price estimate failed ', response, status, headers);
                            throw new Error("" + response);
                        }
                    );
        };

        var buy = function(qty, fiat) {
            return $q.when(activeWallet.getNewAddress()).then(function (address) {

                var params = {
                    address: address
                };

                if (qty != null) {
                    params.btc = qty;
                }
                if (fiat != null) {
                    params.euros = fiat;
                }

                return sdkService.sdk().then(function (sdk) {
                    sdk.getSignedBitonicUrl(activeWallet._sdkWallet.identifier, params).then(function (result) {

                        return dialogService.prompt({
                            body: $translate.instant('MSG_BUYBTC_FORWARD_TO_BROKER', {
                                broker: "Bitonic"
                            }),
                            title: $translate.instant('MSG_BUYBTC_CONFIRM_TITLE'),
                            prompt: false
                        }).result.then(function () {

                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.BITONIC_GOTO_BITONIC);
                            //TODO: Same page '_self' or '_blank' (maybe gets popup alert)
                            window.open(encodeOpenURI(result.url), '_blank');

                            $timeout(function () {
                                $state.go('app.wallet.summary');
                            }, 1000);
                        });
                    });
                });
            });
        };

        return {
            buyPrices: buyPrices,
            buy: buy
        };
    }
);
