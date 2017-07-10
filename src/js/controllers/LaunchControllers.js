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
    .controller('LogoutCtrl', function($state, storageService) {
        storageService.resetAll().then(
            function() {
                window.location.replace('/#/setup/loggedout');
                setTimeout(function() {
                    window.location.reload(true);
                }, 50);
            }
        );
    });

angular.module('blocktrail.wallet').controller('BannedIpCtrl', function($scope, CONFIG, $stateParams) {
    $scope.CONFIG = CONFIG;
    $scope.bannedIp = $stateParams.bannedIp;
});
