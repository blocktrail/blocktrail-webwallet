(function() {
    "use strict";

    angular.module("blocktrail.core")
        .controller("BuyBTCChooseRegionCtrl", BuyBTCChooseRegionCtrl);

    // TODO Needs refactoring
    function BuyBTCChooseRegionCtrl($scope) {
        $scope.usSelected = false;

        $scope.selectUS = function() {
            $scope.usSelected = true;
        };
    }
})();
