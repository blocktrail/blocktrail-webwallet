angular.module("blocktrail.wallet")
    .controller("SettingsToolsCtrl", SettingsToolsCtrl);

function SettingsToolsCtrl($scope, $modal, CONFIG, activeWallet, $log, dialogService, $translate, NotificationsService) {

    $scope.network = activeWallet.getReadOnlyWalletData().networkType;

    $scope.sweepCoins = function () {
        $modal.open({
            controller: "SweepCoinsModalController",
            templateUrl: "js/modules/wallet/controllers/sweep-coins-modal/sweep-coins-modal.tpl.html",
            size: 'md'
        });
    };

    $scope.addProtocolHandler = function() {
        // Prompt user about this feature
        return NotificationsService.promptBitcoinURIHandler().result.then(function() {
            try {
                $log.debug('Trying to register bitcoin URI scheme');
                navigator.registerProtocolHandler(
                    'bitcoin',
                    CONFIG.WALLET_URL + '/#/wallet/handleURI/%s',
                    'BTC.com Bitcoin Wallet'
                );
            } catch (e) {
                $log.error('Couldn\'t register bitcoin: URL scheme', e, e.message);

                if (e.name === "SecurityError") {
                    return dialogService.alert(
                        $translate.instant('ERROR_TITLE_2'),
                        $translate.instant('BROWSER_SECURITY_ERROR'),
                        $translate.instant('OK')
                    ).result;
                }
            }
        });
    };
}