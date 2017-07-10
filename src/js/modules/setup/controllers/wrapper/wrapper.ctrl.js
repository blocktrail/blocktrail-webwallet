(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupWrapperCtrl", SetupWrapperCtrl);

    function SetupWrapperCtrl($scope, $modal, CONFIG, Bowser) {
        var showMobileDialog = !!Bowser.mobile;

        $scope.showMobileDialogOnce = function() {
            if (showMobileDialog) {
                $scope.showMobileDialog =  false;
                $modal.open({
                    controller: "SetupDownloadMobileModalController",
                    templateUrl: "js/modules/setup/controllers/download-mobile-modal/download-mobile-modal.tpl.html"
                });
            }
        };

        $scope.setupInfo = {
            // force uniqueness of the identifier to make it easier to force a
            identifier: CONFIG.DEFAULT_IDENTIFIER + "-" + randomBytes(8).toString("hex"),
            password: "",
            primaryMnemonic: "",
            backupMnemonic: "",
            blocktrailPublicKeys: null
        };
    }
})();