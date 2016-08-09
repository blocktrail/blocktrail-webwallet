angular.module('blocktrail.wallet')
    .controller('ResetCtrl', function($state, storageService) {
        storageService.resetAll().then(
            function() {
                alert('reset!');
                window.location.replace('/');
            }
        );
    });

angular.module('blocktrail.wallet')
    .controller('RebrandCtrl', function($scope, $stateParams) {
        $scope.goto = $stateParams.goto;
    });


angular.module('blocktrail.wallet')
    .controller('LogoutCtrl', function($state, storageService) {
        storageService.resetAll().then(
            function() {
                window.location.replace('/#/setup/login');
                window.location.reload(true);
            }
        );
    });
