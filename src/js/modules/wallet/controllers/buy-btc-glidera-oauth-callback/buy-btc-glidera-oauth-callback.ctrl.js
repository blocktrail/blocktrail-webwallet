(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("BuyBTCGlideraOauthCallbackCtrl", BuyBTCGlideraOauthCallbackCtrl);

    // TODO Needs refactoring
    function BuyBTCGlideraOauthCallbackCtrl($state, glideraService) {
        glideraService.handleOauthCallback(window.location.href)
            .then(function() {
                return glideraService.userCanTransact().then(function(userCanTransact) {
                    if (userCanTransact) {
                        $state.go("app.wallet.buybtc.buy", {broker: "glidera"});
                    } else {
                        $state.go("app.wallet.buybtc.choose");
                    }
                });
            }, function(err) {
                console.error("" + err);
                $state.go("app.wallet.buybtc.choose");
            })
        ;
    }
})();
