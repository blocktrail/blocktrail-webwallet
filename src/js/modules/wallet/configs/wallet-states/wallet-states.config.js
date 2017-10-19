(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .config(walletStateConfig);

    function walletStateConfig($stateProvider) {
        $stateProvider
        /*---Wallet Home---*/
            .state("app.wallet", {
                abstract: true,
                url: "/wallet",
                controller: "WalletCtrl",
                templateUrl: "js/modules/wallet/controllers/wallet/wallet.tpl.html",
                resolve: {
                    globalLock: initGlobalLock,
                    handleSetupState: handleSetupState,
                    checkApiKeyStatus: checkApiKeyStatus,
                    activeWallet: getActiveWallet,
                    loadingData: loadingData
                }
            })
            .state("app.wallet.verifyEmail", {
                url: "/verify-email?token",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/verify-email/verify-email.tpl.html",
                        controller: "VerifyEmailCtrl"
                    }
                }
            })
            .state("app.wallet.summary", {
                url: "",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/wallet-summary/wallet-summary.tpl.html",
                        controller: "WalletSummaryCtrl"
                    }
                }
            })
            /*--- Send ---*/
            .state("app.wallet.send", {
                url: "/send",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/send/send.tpl.html",
                        controller: "SendCtrl"
                    }
                }
            })
            /*--- Receive ---*/
            .state("app.wallet.receive", {
                url: "/receive",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/receive/receive.tpl.html",
                        controller: "ReceiveCtrl"
                    }
                }
            })
            .state("app.wallet.receive.address-lookup", {
                url: "/address-lookup",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/address-lookup/address-lookup.tpl.html",
                        controller: "AddressLookupCtrl"
                    }
                }
            })
            /*--- Settings ---*/
            .state("app.wallet.settings", {
                url: "/settings",
                cache: true,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/settings/settings.tpl.html",
                        controller: "SettingsCtrl"
                    }
                }
            })
            /*--- Buy BTC ---*/
            .state("app.wallet.buybtc", {
                url: "/buy",
                abstract: true,
                template: "<div ui-view></div>"
            })
            .state("app.wallet.buybtc.choose", {
                url: "/choose",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/buy-btc-choose/buy-btc-choose.tpl.html",
                        controller: "BuyBTCChooseCtrl"
                    }
                }
            })
            .state("app.wallet.buybtc.glidera-oauth2-callback", {
                url: "/glidera/oaoth2/callback",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/buy-btc-glidera-oauth-callback/buy-btc-glidera-oauth-callback.tpl.html",
                        controller: "BuyBTCGlideraOauthCallbackCtrl"
                    }
                }
            })
            .state("app.wallet.buybtc.buy", {
                url: "/broker/:broker",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "js/modules/wallet/controllers/buy-btc-broker/buy-btc-broker.tpl.html",
                        controller: "BuyBTCBrokerCtrl"
                    }
                }
            })
    }

    /**
     * Init the global lock
     * @param globalLockService
     */
    function initGlobalLock(globalLockService) {
        globalLockService.init();
    }

    /**
     * Check on availability of state, if a  state is not available, redirect to available state
     *
     * @param $state
     * @param launchService
     *
     * @returns bool
     */
    function handleSetupState($state, launchService) {
        return launchService.handleSetupState(this.toString(), $state);
    }

    /**
     * Check API key status
     * @param launchService
     * @param dialogService
     * @param $filter
     * @param $translate
     * @param $state
     * @param storageService
     */
    function checkApiKeyStatus(launchService, dialogService, $filter, $translate, $state, storageService) {
        return launchService.getWalletConfig()
            .then(function(result) {
                var bannedIp = result.is_banned_ip;
                if (bannedIp) {
                    $state.go("app.bannedip", {bannedIp: bannedIp});
                } else if (result.api_key && (result.api_key !== "ok")) {
                    // alert user session is invalid
                    dialogService.alert({
                        title: $translate.instant("INVALID_SESSION"),
                        bodyHtml: $filter("nl2br")($translate.instant("INVALID_SESSION_LOGOUT_NOW"))
                    })
                        .result
                        .finally(function() {
                            $state.go("app.logout");
                        });

                    // force flushing the storage already
                    storageService.resetAll();
                }
            });
    }

    /**
     * Get the active wallet
     * @param $state
     * @param $q
     * @param launchService
     * @param sdkService
     * @param walletsManagerService
     */
    function getActiveWallet($state, $q, launchService, sdkService, walletsManagerService) {
        return $q.all([launchService.getAccountInfo(), launchService.getWalletInfo()])
            .then(function(data) {
                var accountInfo = data[0];
                var walletInfo = data[1];

                if (!walletInfo.networkType || !walletInfo.identifier) {
                    $state.go("app.logout");
                    throw new Error("Missing networkType or identifier");
                }

                sdkService.setAccountInfo(accountInfo);
                sdkService.setNetworkType(walletInfo.networkType);

                return walletsManagerService.fetchWalletsList()
                    .then(function() {
                        var activeWallet = walletsManagerService.getActiveWallet();

                        // active wallet is null when we load first time
                        if (!activeWallet) {
                            activeWallet = walletsManagerService.setActiveWalletByNetworkTypeAndIdentifier(walletInfo.networkType, walletInfo.identifier);
                        } else {
                            sdkService.setNetworkType(activeWallet.getReadOnlyWalletData().networkType);
                        }

                        return activeWallet;
                    });
            })
            .then(function(activeWallet) {
                var walletData = activeWallet.getReadOnlyWalletData();

                return launchService.storeWalletInfo(walletData.identifier, walletData.networkType)
                    .then(function() {
                        return activeWallet;
                    });
            });
    }

    /**
     * Loading data
     * @param settingsService
     * @param $q
     * @param $rootScope
     * @param $log
     * @param Currencies
     */
    /**
     * !! activeWallet and handleSetupState should stay in here even when not used
     * !! to make sure the resolves happen in the correct order
     * TODO Review
     */
    function loadingData(settingsService, $q, $rootScope, $log, Currencies, activeWallet, handleSetupState) {
        // Do an initial load of cached user data
        return $q.all([
            Currencies.updatePrices(true),
            settingsService.getSettings()
        ]).then(function(results) {
            $log.debug("Initial load complete");
            $rootScope.bitcoinPrices = results[0];
            $rootScope.changeLanguage(results[1].language);
            return true;
        });
    }

})();
