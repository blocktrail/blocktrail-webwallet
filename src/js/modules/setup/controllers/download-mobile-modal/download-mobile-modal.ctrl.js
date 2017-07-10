(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupDownloadMobileModalController", SetupDownloadMobileModalController);

    function SetupDownloadMobileModalController($scope, $modalInstance, Bowser) {
        $scope.mobileOs = Bowser.android ? "android" : Bowser.ios ? "ios" : "both";

        $scope.dismiss = function() {
            $modalInstance.close();
        };
    }
})();
