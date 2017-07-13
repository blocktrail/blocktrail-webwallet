(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("ModalCropImageCtrl", ModalCropImageCtrl);

    function ModalCropImageCtrl($scope, $modalInstance, imgData) {
        $scope.image = imgData;
        $scope.croppedImage = '';

        $scope.dismiss = function() {
            $modalInstance.dismiss();
        };

        $scope.ok = function() {
            $modalInstance.close($scope.croppedImage);
        };
    }
})();
