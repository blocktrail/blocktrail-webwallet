(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LogoutCtrl", LogoutCtrl);


    function LogoutCtrl($window, storageService, CONFIG) {
        storageService
            .resetAll()
            .then(function() {
                if (CONFIG.PROMOTE_MOBILE) {
                    $window.location.replace("/#/setup/loggedout");
                } else {
                    $window.location.replace("/#/setup/login");
                }

                $window.location.reload();
            }
        );
    }

})();
