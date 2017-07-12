(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LogoutCtrl", LogoutCtrl);


    function LogoutCtrl($window, storageService) {
        storageService
            .resetAll()
            .then(function() {
                $window.location.replace("/#/setup/loggedout");
                $window.location.reload();
            }
        );
    }

})();
