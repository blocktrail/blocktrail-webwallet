(function () {
    "use strict";

    angular.module("blocktrail.core")
        .controller("DialogSpinnerModalCtrl", DialogSpinnerModalCtrl);


    function DialogSpinnerModalCtrl($scope, $modalInstance, message, dialogId) {
        $scope.message = message;

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.$on('dialog:' + dialogId, function(event, message) {
            $scope.message = message;
        });
    }
})();
