(function() {
    "use strict";

    angular.module("blocktrail.core")
        .controller("DialogAlertModalCtrl", DialogAlertModalCtrl);

    function DialogAlertModalCtrl($scope, $modalInstance, message, dialogId) {
        $scope.message = message;

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.close = function() {
            $modalInstance.close();
        };

        $scope.$on("dialog:" + dialogId, function(event, message) {
            $scope.message = message;
        });
    }
})();
