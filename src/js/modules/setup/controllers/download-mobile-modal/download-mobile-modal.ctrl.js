(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupDownloadMobileModalController", SetupDownloadMobileModalController);

    function SetupDownloadMobileModalController($scope, $modalInstance) {
        $scope.mobileOs = bowser.android ? "android" : bowser.ios ? "ios" : "both";

        $scope.dismiss = function() {
            $modalInstance.close();
        };
    }
})();
