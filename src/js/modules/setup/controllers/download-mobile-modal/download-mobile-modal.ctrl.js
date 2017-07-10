(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupDownloadMobileModalController", SetupDownloadMobileModalController);

    function SetupDownloadMobileModalController($scope, $modalInstance, bowserJS) {
        $scope.mobileOs = bowserJS.android ? "android" : bowserJS.ios ? "ios" : "both";

        $scope.dismiss = function() {
            $modalInstance.close();
        };
    }
})();
