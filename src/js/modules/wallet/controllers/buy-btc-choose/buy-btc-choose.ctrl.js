(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("BuyBTCChooseCtrl", BuyBTCChooseCtrl);

    // TODO Needs refactoring
    function BuyBTCChooseCtrl($rootScope, $q, $scope, $state, _, dialogService, settingsService, activeWallet,
                              $translate, glideraService, buyBTCService, $log, trackingService, $timeout, CONFIG) {
        var settings = settingsService.getReadOnlySettingsData();
        var walletData = activeWallet.getReadOnlyWalletData();

        $scope.brokers = [];
        $scope.network = CONFIG.NETWORKS[walletData.networkType].TICKER;
        $scope.networkLong = CONFIG.NETWORKS[walletData.networkType.replace("t", "")].NETWORK_LONG;
        $scope.simplexEnabled = false;
        $scope.glideraEnabled = false;

        $scope.$watch('brokers', function() {
            $scope.simplexEnabled = CONFIG.FORCE_SIMPLEX_ENABLED || $scope.brokers.indexOf('simplex') !== -1;
            $scope.glideraEnabled = CONFIG.FORCE_GLIDERA_ENABLED || $scope.brokers.indexOf('glidera') !== -1;
        });

        buyBTCService.brokers().then(function(brokers) {
            $timeout(function() {
                $scope.brokers = brokers;
            });
        });

        $rootScope.pageTitle = $translate.instant("BUYBTC_NETWORK", { network: $scope.network });

        $scope.goBuyBTCState = function(broker) {
            $state.go("app.wallet.buybtc.buy", {broker: broker});
        };

        $scope.goGlideraBrowser = function() {
            glideraService.userCanTransact().then(function(userCanTransact) {
                if (!userCanTransact) {
                    return glideraService.accessToken().then(function(accessToken) {
                        if (accessToken) {
                            // 2: Additional user verification information is required
                            if (settings.glideraAccessToken.userCanTransactInfo.code == 2) {
                                trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_SETUP_UPDATE);
                                return dialogService.prompt({
                                    body: $translate.instant("MSG_BUYBTC_SETUP_MORE_GLIDERA_BODY", {
                                        message: settings.glideraAccessToken.userCanTransactInfo.message
                                    }),
                                    title: $translate.instant("MSG_BUYBTC_SETUP_MORE_GLIDERA_TITLE"),
                                    prompt: false
                                })
                                    .result
                                    .then(function() {
                                        return glideraService.setup();
                                    }, function() {
                                        // -
                                    });

                            } else if (settings.glideraAccessToken.userCanTransactInfo) {
                                throw new Error("User can't transact because: " + settings.glideraAccessToken.userCanTransactInfo.message);
                            } else {
                                throw new Error("User can't transact for unknown reason!");
                            }

                        } else {
                            trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_SETUP_INIT);
                            return dialogService.prompt({
                                body: $translate.instant("MSG_BUYBTC_SETUP_GLIDERA_BODY"),
                                title: $translate.instant("MSG_BUYBTC_SETUP_GLIDERA_TITLE"),
                                prompt: false
                            })
                                .result
                                .then(function() {
                                    return glideraService.oauth2();
                                }, function() {
                                    // -
                                })
                                ;
                        }
                    });
                } else {
                    $state.go("app.wallet.buybtc.buy", {broker: "glidera"});
                }
            })
                .then(function() {
                    // -
                }, function(err) {
                    if (!dialogService.isCancel(err)) {
                        alert(err);
                    }
                })
            ;
        };

        /**
         * reset buy BTC state for debugging purposes
         */
        $scope.resetBuyBTC = function() {
            return $q.when()
                .then(function() {
                    var updateSettings = {
                        glideraAccessToken: null,
                        glideraTransactions: []
                    };

                    return settingsService.updateSettingsUp(updateSettings);
                })
                .then(function() {
                    $state.go("app.wallet.summary");
                }, function(err) {
                    alert(err);
                });
        };
    }
})();
