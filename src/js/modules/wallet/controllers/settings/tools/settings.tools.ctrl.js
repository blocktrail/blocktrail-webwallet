angular.module("blocktrail.wallet")
    .controller("SettingsToolsCtrl", SettingsToolsCtrl);

function SettingsToolsCtrl($scope, $modal) {
    $scope.sweepCoins = function () {
        $modal.open({
            controller: "SweepCoinsModalController",
            templateUrl: "js/modules/wallet/controllers/sweep-coins-modal/sweep-coins-modal.tpl.html",
            size: 'md'
        });
    };
}