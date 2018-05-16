(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("PaymentURICtrl", PaymentURIController);
    function PaymentURIController($state, $stateParams, bitcoinLinkService) {
        var scheme = $stateParams.scheme;
        return bitcoinLinkService.parse(scheme).then(function (sendInput) {
            if(sendInput && (sendInput.network === 'bitcoin' || sendInput.network === 'bitcoincash')) {
                $state.go('app.wallet.send', {
                    sendInput: sendInput
                });
            } else {
                $state.go('app.wallet.summary');
            }
        });
    }
})();
