(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LogoutCtrl", LogoutCtrl);

    function LogoutCtrl($window, $stateParams, storageService, walletsManagerService) {
        if ($stateParams.continue) {
            $window.location.replace("/#/loggedout");
        } else {
            var activeWallet = walletsManagerService.getActiveWallet();
            if (activeWallet) {
                activeWallet.disablePolling();
            }

            storageService
                .resetAll()
                .then(function() {
                        $window.location.replace("/#/logout?continue=1");
                        $window.location.reload();
                    }
                );
        }
    }
})();
