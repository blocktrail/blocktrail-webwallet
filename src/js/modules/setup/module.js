(function () {
    'use strict';

    angular.module('blocktrail.setup', []);

    // TODO
    angular.module('blocktrail.setup').config(function ($stateProvider) {

        $stateProvider
            .state('app.setup', {
                url: "/setup",
                abstract: true,
                controller: "SetupCtrl",
                templateUrl: "templates/setup/setup.html",
                resolve: {
                    /**
                     * check for extra languages to enable
                     * if new language is new preferred, set it
                     */
                    preferredLanguage: function(CONFIG, $rootScope, $state, blocktrailLocalisation, launchService) {
                        var bannedIp = false;

                        return launchService.getWalletConfig()
                            .then(function(result) {
                                bannedIp = result.is_banned_ip;
                                return result.extraLanguages.concat(CONFIG.EXTRA_LANGUAGES).unique();
                            })
                            .then(function(extraLanguages) {
                                // parse extra languages to determine if there's any new
                                var r = blocktrailLocalisation.parseExtraLanguages(extraLanguages);
                                var preferredLanguage;

                                // if there's any new we should store those
                                if (r) {
                                    var newLanguages = r[0];
                                    preferredLanguage = r[1];
                                } else {
                                    preferredLanguage = blocktrailLocalisation.setupPreferredLanguage();
                                }

                                // activate preferred language
                                $rootScope.changeLanguage(preferredLanguage);
                            })
                            .then(function() {
                                if (bannedIp) {
                                    $state.go('app.bannedip', {bannedIp: bannedIp});
                                }
                            }, function(e) {
                                console.error(e);
                            });
                    }
                }
            })
            .state('app.setup.loggedout', {
                url: "/loggedout",
                cache: false,
                controller: "SetupLoggedoutCtrl",
                templateUrl: "templates/setup/setup.loggedout.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.setup.loggedout', $state);
                    }
                }
            })
            .state('app.setup.login', {
                url: "/login",
                cache: false,
                controller: "SetupLoginCtrl",
                templateUrl: "templates/setup/setup.login.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.setup.login', $state);
                    }
                }
            })
            .state('app.setup.rebrand', {
                url: "/rebrand?goto",
                controller: "RebrandCtrl",
                templateUrl: "templates/setup/setup.rebrand.html"
            })
            .state('app.setup.register', {
                url: "/register",
                cache: false,
                controller: "SetupNewAccountCtrl",
                templateUrl: "templates/setup/setup.register.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.setup.register', $state);
                    }
                }
            })
            .state('app.setup.forgotpass', {
                url: "/forgotpass",
                cache: false,
                controller: "SetupForgotPassCtrl",
                templateUrl: "templates/setup/setup.forgotpass.html",
                resolve: {}
            })
            .state('app.setup.wallet', {
                url: "/wallet",
                cache: false,
                controller: "SetupWalletInitCtrl",
                templateUrl: "templates/setup/setup.wallet.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.setup.wallet', $state);
                    }
                }
            })
            .state('app.setup.backup', {
                url: "/wallet-backup",
                cache: false,
                controller: "SetupWalletBackupCtrl",
                templateUrl: "templates/setup/setup.wallet-backup.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.setup.backup', $state);
                    },
                    backupInfo: function($state, launchService) {
                        return launchService.getBackupInfo(true);
                    }
                }
            })

    });

})();