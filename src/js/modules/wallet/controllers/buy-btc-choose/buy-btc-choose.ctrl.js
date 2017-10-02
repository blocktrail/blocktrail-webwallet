(function() {
    "use strict";

    angular.module("blocktrail.core")
        .controller("BuyBTCChooseCtrl", BuyBTCChooseCtrl);

    // TODO Needs refactoring
    function BuyBTCChooseCtrl($q, $scope, $state, _, dialogService, settingsService,
                              $translate, glideraService, buyBTCService, $log, trackingService) {
        var settings = settingsService.getReadOnlySettingsData();

        $scope.brokers = [];
        // load chooseRegion from settingsService
        $scope.chooseRegion = null;

        $q.all([,
            buyBTCService.regions().then(function(regions) {
                $scope.regions = regions;
            }),
            buyBTCService.usStates().then(function(usStates) {
                $scope.usStates = usStates;
            })
        ]).then(function() {
            $scope.chooseRegion = _.defaults({}, settings.buyBTCRegion, {
                code: null,
                name: null
            });

            return buyBTCService.regionBrokers($scope.chooseRegion.code).then(function(brokers) {
                $scope.brokers = brokers;
                $scope.chooseRegion.regionOk = $scope.brokers.length;
            });
        });

        $scope.selectRegion = function(region, name) {
            $log.debug("selectRegion: " + region + " (" + name + ")");
            $scope.chooseRegion.code = region;
            $scope.chooseRegion.name = name;

            buyBTCService.regionBrokers($scope.chooseRegion.code).then(function(brokers) {
                $scope.brokers = brokers;
                $scope.chooseRegion.regionOk = $scope.brokers.length;

                if ($scope.chooseRegion.regionOk) {
                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.REGION_OK);
                } else {
                    trackingService.trackEvent(trackingService.EVENTS.BUYBTC.REGION_NOTOK);
                }

                var updateSettings = {
                    buyBTCRegion: _.defaults({}, $scope.chooseRegion)
                };

                return settingsService.updateSettingsUp(updateSettings);
            });
        };

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
                        buyBTCRegion: null,
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
