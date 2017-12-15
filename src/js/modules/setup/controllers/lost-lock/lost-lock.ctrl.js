(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("LostLockCtrl", LostLockCtrl);


    function LostLockCtrl($scope, $stateParams, $timeout, $window) {
        if ($stateParams.refresh === "1") {
            $window.location.replace("/#/lostlock?refresh=0");
            // short timeout to avoid redirect loop
            $timeout(function() {
                $window.location.reload();
            }, 100);
        }
    }

})();
