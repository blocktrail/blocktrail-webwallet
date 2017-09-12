(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LogoutCtrl", LogoutCtrl);

    function LogoutCtrl($window, CONFIG, storageService, walletsManagerService) {
        var activeWallet = walletsManagerService.getActiveWallet();

        if (activeWallet) {
            activeWallet.disablePolling();
            storageService
                .resetAll()
                .then(function() {
                        $window.location.reload();
                    }
                );
        } else {
            if (CONFIG.PROMOTE_MOBILE) {
                $window.location.replace("/#/setup/loggedout");
            } else {
                $window.location.replace("/#/setup/login");
            }
        }
    }
})();
