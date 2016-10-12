angular.module('blocktrail.wallet')
    .controller('DialogAlertCtrl', function($scope, $modalInstance, message, dialogId) {
        $scope.message = message;

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.close = function() {
            $modalInstance.close();
        };

        $scope.$on('dialog:' + dialogId, function(event, message) {
            $scope.message = message;
        });
    })
    .controller('DialogPromptCtrl', function($scope, $modalInstance, message, dialogId) {
        $scope.message = message;
        $scope.form = {
            prompt: ""
        };

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.submit = function() {
            $modalInstance.close($scope.form.prompt);
        };

        $scope.$on('dialog:' + dialogId, function(event, message) {
            $scope.message = message;
        });
    })
    .controller('DialogSpinnerCtrl', function($scope, $modalInstance, message, dialogId) {
        $scope.message = message;

        $scope.dismiss = function() {
            $modalInstance.dismiss("dismiss");
        };

        $scope.$on('dialog:' + dialogId, function(event, message) {
            $scope.message = message;
        });
    })
;
