(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .config(setupStateConfig);

    function setupStateConfig($stateProvider) {
        $stateProvider
            .state('app.logout', {
                url: "/logout",
                controller: "LogoutCtrl"
            })
            .state('app.bannedip', {
                url: "/bannedip?bannedIp",
                cache: false,
                controller: "BannedIpCtrl",
                templateUrl: "js/modules/setup/controllers/banned-ip/banned-ip.tpl.html"
            })
            .state('app.lostlock', {
                url: "/lostlock?refresh",
                cache: false,
                controller: "LostLockCtrl",
                templateUrl: "js/modules/setup/controllers/lost-lock/lost-lock.tpl.html"
            })
            .state("app.setup", {
                url: "/setup",
                abstract: true,
                controller: "SetupWrapperCtrl",
                templateUrl: "js/modules/setup/controllers/wrapper/wrapper.tpl.html",
                resolve: {
                    globalLock: function(globalLockService) {
                        globalLockService.init();
                    },
                    preferredLanguage: preferredLanguage,
                    sdkSetAccountInfo: function(launchService, sdkService) {
                        return launchService.getAccountInfo().then(function(accountInfo) {
                            return sdkService.setAccountInfo(accountInfo);
                        });
                    }
                }
            })
            .state("app.setup.login", {
                url: "/login",
                cache: false,
                controller: "SetupLoginCtrl",
                templateUrl: "js/modules/setup/controllers/login/login.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.loggedout", {
                url: "/loggedout",
                cache: false,
                controller: "SetupLoggedoutCtrl",
                templateUrl: "js/modules/setup/controllers/loggedout/loggedout.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.register", {
                url: "/register",
                cache: false,
                controller: "SetupNewAccountCtrl",
                templateUrl: "js/modules/setup/controllers/new-account/new-account.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.forgotPassword", {
                url: "/forgot-password",
                cache: false,
                controller: "SetupForgotPasswordCtrl",
                templateUrl: "js/modules/setup/controllers/forgot-password/forgot-password.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.changePassword", {
                url: "/change-password?token&recovery&version&requires_2fa",
                cache: false,
                controller: "SetupChangePasswordCtrl",
                templateUrl: "js/modules/setup/controllers/change-password/change-password.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.wallet", {
                url: "/wallet",
                cache: false,
                controller: "SetupWalletInitCtrl",
                templateUrl: "js/modules/setup/controllers/wallet-init/wallet-init.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState
                }
            })
            .state("app.setup.walletBackup", {
                url: "/wallet-backup",
                cache: false,
                controller: "SetupWalletBackupCtrl",
                templateUrl: "js/modules/setup/controllers/wallet-backup/wallet-backup.tpl.html",
                resolve: {
                    handleSetupState: handleSetupState,
                    backupInfo: backupInfo
                }
            })
            .state("app.setup.rebrand", {
                url: "/rebrand?goto",
                controller: "SetupRebrandCtrl",
                templateUrl: "js/modules/setup/controllers/rebrand/rebrand.tpl.html"
            });
    }

    /**
     * Check for extra languages to enable, if new language is new preferred, set it
     *
     * @param CONFIG
     * @param $rootScope
     * @param $state
     * @param blocktrailLocalisation
     * @param launchService
     */
    function preferredLanguage($state, $rootScope, CONFIG, blocktrailLocalisation, launchService) {
        var bannedIp = false;

        // TODO Review this part
        return launchService.getWalletConfig()
            .then(function(result) {
                bannedIp = result.is_banned_ip;
                return result.extraLanguages.concat(CONFIG.EXTRA_LANGUAGES).unique();
            })
            .then(function(extraLanguages) {
                // parse extra languages to determine if there"s any new
                var r = blocktrailLocalisation.parseExtraLanguages(extraLanguages);
                var preferredLanguage;

                // if there"s any new we should store those
                if (r) {
                    preferredLanguage = r[1];
                } else {
                    preferredLanguage = blocktrailLocalisation.setupPreferredLanguage();
                }

                // activate preferred language
                $rootScope.changeLanguage(preferredLanguage);
            })
            .then(function() {
                if (bannedIp) {
                    $state.go("app.bannedip", { bannedIp: bannedIp });
                }
            }, function(e) {
                console.error(e);
            });
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
     * TODO ???
     *
     * @param launchService
     */
    function backupInfo(launchService) {
        return launchService.getBackupInfo(true);
    }

})();
