(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("BannedIpCtrl", BannedIpCtrl);


    function BannedIpCtrl($scope, CONFIG, $stateParams) {
        $scope.CONFIG = CONFIG;
        $scope.bannedIp = $stateParams.bannedIp;
    }

})();
