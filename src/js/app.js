/* globals blocktrailSDK, window */
// bind a few things from the browserified blocktrailSDK to the window
window.CryptoJS = blocktrailSDK.CryptoJS;
window.bitcoinjs = blocktrailSDK.bitcoin;
window.randomBytes = blocktrailSDK.randomBytes;
window._ = blocktrailSDK.lodash;

// gotta fake some ionic stuff
var ionic = window.ionic = {};
ionic.Platform = ionic.Platform || {};
ionic.Platform.device = function() { return {}; };
ionic.Platform.isWebView = function() { return true; };

var blocktrail = angular.module('blocktrail.wallet', [
    'ionic.service.core',
    'ionic.service.analytics',
    'ui.router',
    'ui.bootstrap',
    'toggle-switch',
    'infinite-scroll',
    'angularMoment',
    'ja.qr',
    'ngImgCrop',
    'blocktrail.localisation',

    'blocktrail.config'
]);

angular.module('blocktrail.wallet').factory(
    '$ionicCoreSettings',
    function(CONFIG) {
        return {
            get: function(setting) {
                if (CONFIG.IO_CONFIG[setting]) {
                    return CONFIG.IO_CONFIG[setting];
                }
                return null;
            }
        }
    }
);

/*--- Blocktrail Error Classes ---*/
angular.module('blocktrail.wallet').config(function() {
    //merge in sdk error classes
    Object.keys(blocktrailSDK).forEach(function(val) {
        if (blocktrailSDK[val].super_ == Error) {
            blocktrail[val] = blocktrailSDK[val];
        }
    });

    blocktrail.ContactsPermissionError = Error.extend("ContactsPermissionError", 400);
    blocktrail.ContactsError = Error.extend("ContactsError", 400);
    blocktrail.ContactAddressError = Error.extend("ContactAddressError", 400);
    blocktrail.WalletPinError = Error.extend("WalletPinError", 400);
    blocktrail.WalletPollError = Error.extend("WalletPollError", 400);
});

angular.module('blocktrail.wallet').run(
    function($rootScope, $state, $ionicUser, $ionicAnalytics, $log, $interval, $timeout, settingsService, CONFIG, $locale, $translate, amMoment) {
        $rootScope.CONFIG       = CONFIG || {};
        $rootScope.$state       = $state;
        $rootScope.appVersion   = CONFIG.VERSION;

        $rootScope.bodyClass = [];
        $rootScope.bodyClassStr = "";

        $rootScope.currencies = [
            {code: 'USD', symbol: '$'},
            {code: 'EUR', symbol: '€'},
            {code: 'GBP', symbol: '£'}
        ];

        $rootScope.changeLanguage = function(language) {
            settingsService.language = language || $translate.preferredLanguage() || CONFIG.FALLBACK_LANGUAGE || 'en';

            amMoment.changeLocale(settingsService.language);
            $translate.use(settingsService.language);
        };

        // start loading settings
        settingsService.$isLoaded().then(function() {
            $rootScope.settings = settingsService;

            // set the preferred/detected language
            $rootScope.changeLanguage(settingsService.language);
        });

        // register for usage data tracking @TODO: make configurable just like in mobile app
        $ionicAnalytics.register({
            silent: !CONFIG.DEBUG
        });

        $ionicAnalytics.track('Load', {});

        // 'identify' user, by device.uuid
        //  won't have any effect unless $ionicAnalytics.register is called
        $ionicUser.identify({
            user_id: window.device ? window.device.uuid : $ionicUser.generateGUID()
        });

        $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
            $log.error('Error transitioning to '+toState.name + ' from  '+fromState.name, toState, fromState, error);
            $state.go('app.error');
            event.preventDefault();
        });

        //--- Debugging info ---
        $rootScope.$on("$stateChangeStart", function(event, toState, toParams, fromState, fromParams) {
            $log.debug("$stateChangeStart", toState.name, Object.keys(toParams).map(function(k) { return k + ":" + toParams[k]; }));
        });

        $rootScope.$on("$stateChangeSuccess", function(event, toState, toParams, fromState, fromParams) {
            $log.debug("$stateChangeSuccess", toState.name, Object.keys(toParams).map(function(k) { return k + ":" + toParams[k]; }));

            var name;

            name = [];
            fromState.name.split('.').forEach(function(part) {
                name.push(part);
                var idx = $rootScope.bodyClass.indexOf('state-' + name.join("_"));
                if (idx !== -1) {
                    $rootScope.bodyClass.splice(idx, 1);
                }
            });

            name = [];
            toState.name.split('.').forEach(function(part) {
                name.push(part);
                $rootScope.bodyClass.push('state-' + name.join("_"));
            });

            $rootScope.bodyClassStr = $rootScope.bodyClass.join(" ");
        });

        $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams) {
            $log.debug("$stateChangeError", toState.name, Object.keys(toParams).map(function(k) { return k + ":" + toParams[k]; }));
        });
    }
);

/*--- Angular Moment Config ---*/
angular.module('blocktrail.wallet')
    .constant('angularMomentConfig', {
        //preprocess: 'unix', // optional
        //timezone: 'Europe/London' // optional
    })
    .run(function(amMoment) {
        moment.locale('en-custom', {
            calendar : {
                lastDay : '[Yesterday]',
                sameDay : '[Today]',
                nextDay : '[Tomorrow]',
                lastWeek : 'MMMM D',
                nextWeek : 'MMMM Do YYYY',
                sameElse : 'MMMM Do YYYY'
            }
        });

        amMoment.changeLocale('en-custom');
    });
angular.module('blocktrail.wallet').config(
    function($stateProvider, $urlRouterProvider, $logProvider, $ionicAutoTrackProvider, CONFIG) {
        $ionicAutoTrackProvider.disableTracking('Tap');
        $logProvider.debugEnabled(CONFIG.DEBUG);
        $stateProvider
            .state('app', {
                abstract: true,
                templateUrl: "templates/common/base.html"
            })

            /*---Launch---*/
            .state('app.reset', {
                url: "/reset",
                controller: "ResetCtrl"
            })
            .state('app.logout', {
                url: "/logout",
                controller: "LogoutCtrl"
            })

            /*---Setup---*/
            .state('app.setup', {
                url: "/setup",
                abstract: true,
                controller: "SetupCtrl",
                templateUrl: "templates/setup/setup.html"
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


            /*---Wallet Home---*/
            .state('app.wallet', {
                abstract: true,
                url: "/wallet",
                controller: "WalletCtrl",
                templateUrl: "templates/wallet/wallet.html",
                resolve: {
                    handleSetupState: function($state, launchService) {
                        return launchService.handleSetupState('app.wallet', $state);
                    },
                    /**
                     * @param handleSetupState      require handleSetupState to make sure we don't load anything before we're sure we're allowed too
                     * @param Wallet
                     * @param settingsService
                     * @param $q
                     * @param $rootScope
                     * @param $log
                     */
                    loadingData: function(handleSetupState, Wallet, settingsService, $q, $rootScope, $log) {
                        //do an initial load of cached user data
                        return $q.all([
                            Wallet.balance(true),
                            Wallet.price(true),
                            settingsService.$isLoaded()
                        ]).then(function(results) {
                            $log.debug('initial load complete');
                            $rootScope.balance = results[0].balance;
                            $rootScope.uncBalance = results[0].uncBalance;

                            $rootScope.bitcoinPrices = results[1];
                            return true;
                        });
                    }
                }
            })

            .state('app.wallet.summary', {
                url: "",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/wallet/wallet.summary.html",
                        controller: 'WalletSummaryCtrl'
                    }
                }
            })

            /*--- Send ---*/
            .state('app.wallet.send', {
                url: "/send",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/send/send.input-screen.html",
                        controller: 'SendCtrl'
                    }
                }
            })

            /*--- Receive ---*/
            .state('app.wallet.receive', {
                url: "/receive",
                cache: false,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/receive/receive.new-address.html",
                        controller: 'ReceiveCtrl'
                    }
                }
            })

            /*--- Settings ---*/
            .state('app.wallet.settings', {
                url: "/settings",
                cache: true,
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/settings/settings.html",
                        controller: 'SettingsCtrl'
                    }
                }
            })

            /*--- Error ---*/
            .state('app.error', {
                views: {
                    "mainView@app.wallet": {
                        template: "<h1 style='text-align: center; margin-top: 5rem'>Ooops!<br><small>Something went wrong</small></h1>"
                    }
                }
            })
        ;

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/setup/register');
    }
);

// patching ES6 Promises :/
if (typeof Promise !== "undefined") {
    Promise.prototype.done = function() {
        return this.then(
            function(r) {
                return r;
            },
            function(e) {
                setTimeout(function() {
                    throw e;
                });
            }
        );
    };
}

// patching promise library that PoucDB uses
if (typeof PouchDB.utils.Promise.prototype.done === "undefined") {
    PouchDB.utils.Promise.prototype.done = function() {
        return this.then(
            function(r) {
                return r;
            },
            function(e) {
                setTimeout(function() {
                    throw e;
                });
            }
        );
    };
}

String.prototype.sentenceCase = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.capitalize  = function() {
    return this.replace(/\w\S*/g, function(txt) {
        return txt.sentenceCase();
    });
};

Array.prototype.unique = function() {
    return this.filter(function onlyUnique(value, index, self) {
        return value && self.indexOf(value) === index;
    });
};

Array.prototype.any = function(fn) {
    var match = null;

    this.forEach(function(value, index) {
        if (!match && fn(value, index)) {
            match = value;
        }
    });

    return match;
};

Array.prototype.clean = function() {
    return this.filter(function onlyNotNull(value) {
        return value;
    });
};

if (!Array.prototype.last) {
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
}

if (!Array.prototype.sample) {
    Array.prototype.sample = function(size) {
        var shuffled = this.slice(0), i = this.length, temp, index;

        while (i--) {
            index = Math.floor((i + 1) * Math.random());
            temp = shuffled[index];
            shuffled[index] = shuffled[i];
            shuffled[i] = temp;
        }

        return shuffled.slice(0, size);
    };
}

if (!window.repeat) {
    window.repeat = function(n, fn) {
        var r = [];
        for (var i = 0; i < n; i++) {
            r.push(fn(i));
        }

        return r;
    };
}

/**
 * use promises to loop over a `list` of items and execute `fn`
 * with a trailing window of `n` items to avoid blocking
 *
 * @param list
 * @param n
 * @param fn
 */
window.QforEachLimit = function(list, n, fn) {
    // copy list (we'll by popping and we don't want to modify the list)
    var queue = list.slice();
    var results = [];

    if (typeof n === "function") {
        fn = n;
        n = null;
    }

    // exec batch() which is recursive
    return (function batch() {
        var b = [], v;

        if (n === null) {
            b = queue;
        } else {
            // pop until you drop
            for (var i = 0; i < n; i++) {
                v = queue.shift();
                if (v) {
                    b.push(v);
                }
            }
        }

        // when there's nothing left pop'd we'll return the final results
        if (!b.length) {
            return Q.when(results);
        }

        // create a .all promise for this batch
        return Q.all(
            b.map(function(i) {
                return Q.when(i).then(fn);
            })
        )
            // when the batch is done we concat the results and continue
            .then(function(_results) {
                if (n === null) {
                    return _results;
                } else {
                    results = results.concat(_results);

                    return batch();
                }
            })
            ;
    })();
};
