(function() {
    "use strict";

    angular.module("blocktrail.core")
        .controller("DialogPromptModalCtrl", DialogPromptModalCtrl);

    function DialogPromptModalCtrl($scope, $modalInstance, message, dialogId) {
        $scope.message = message;
        $scope.form = {
            prompt: message.prefill || ""
        };

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.submit = function() {
            $modalInstance.close($scope.form.prompt);
        };

        $scope.$on("dialog:" + dialogId, function(event, message) {
            $scope.message = message;
        });
    }
})();
