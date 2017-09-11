(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LostLockCtrl", LostLockCtrl);


    function LostLockCtrl($scope, $stateParams, $window) {
        if ($stateParams.refresh === "1") {
            $window.location.replace("/#/lostlock?refresh=0");
            $window.location.reload();
        }
    }

})();
