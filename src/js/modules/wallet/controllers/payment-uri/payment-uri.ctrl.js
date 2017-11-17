(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("PaymentURICtrl", PaymentURIController);
    function PaymentURIController($state, $stateParams, bitcoinLinkService) {
        var scheme = $stateParams.scheme;
        console.log(scheme);
        //parse result for address
        var elm = angular.element('<a>').attr('href', scheme )[0];

        if (elm.protocol === 'bitcoin:' || elm.protocol === 'bitcoincash:') {
            var uri = bitcoinLinkService.decodeBitcoin(scheme);
            if (uri.options.r) {
                $state.go('app.wallet.send', {
                    protocol: elm.protocol.slice(0, -1),
                    uri: scheme,
                    paymentUrl: uri.options.r
                });
            } else if (uri.options.amount || uri.address) {
                $state.go('app.wallet.send', {
                    protocol: elm.protocol.slice(0, -1),
                    uri: scheme,
                    amount: uri.options.amount,
                    address: uri.address
                });
            } else {
                // something was horribly wrong?
                $state.go('app.wallet.summary');
            }
        }
    }
})();
