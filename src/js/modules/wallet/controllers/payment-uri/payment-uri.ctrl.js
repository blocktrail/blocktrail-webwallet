(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("PaymentURICtrl", PaymentURIController);

    function PaymentURIController($state, $stateParams) {

        var scheme = $stateParams.scheme;
        //parse result for address
        var elm = angular.element('<a>').attr('href', scheme )[0];
        if (elm.protocol === 'bitcoin:') {
            var addressSchemeRegex = /bitcoin:([13][1-9A-HJ-NP-Za-km-z]{25,34})/;
            var address = addressSchemeRegex.exec(scheme)[1];

            var qs = parseQuery(scheme);

            if (qs.amount || address) {
                $state.go('app.wallet.send', {
                    protocol: elm.protocol.slice(0, -1),
                    amount: qs.amount,
                    address: address,
                });
            }
        }
    }
})();
