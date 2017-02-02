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
    'ui.router',
    'ui.bootstrap',
    'toggle-switch',
    'infinite-scroll',
    'angularMoment',
    'ja.qr',
    'ngImgCrop',
    'blocktrail.localisation',

    'angulartics',
    'angulartics.google.analytics',

    'blocktrail.config',
    'blocktrail.templates'
]);

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
    function($rootScope, $state, $log, $interval, $timeout, settingsService, CONFIG, $locale, $translate, amMoment) {
        $rootScope.CONFIG       = CONFIG || {};
        $rootScope.$state       = $state;
        $rootScope.appVersion   = CONFIG.VERSION;

        $rootScope.bodyClass = [];
        $rootScope.bodyClassStr = "";

        $rootScope.changeLanguage = function(language) {
            settingsService.language = language || blocktrailLocalisation.preferredAvailableLanguage() || CONFIG.FALLBACK_LANGUAGE || 'en';

            var momentLocale = settingsService.language;
            if (momentLocale == 'cn') {
                momentLocale = 'zh-cn';
            }

            amMoment.changeLocale(momentLocale);
            $translate.use(settingsService.language);
        };

        // start loading settings
        settingsService.$isLoaded().then(function() {
            $rootScope.settings = settingsService;

            // set the preferred/detected language
            $rootScope.changeLanguage(settingsService.language);
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
    .run(function(TRANSLATIONS, CONFIG, $filter) {
        var translate = function(key, language) {
            if (!TRANSLATIONS[language]) {
                throw new Error(language);
            }

            return TRANSLATIONS[language][key] || (CONFIG.FALLBACK_LANGUAGE && TRANSLATIONS['english'][key]) || key;
        };

        var MMMMDoYYYYLocales = {
            'en': 'english',
            'en-US': 'english'
        };
        Object.keys(MMMMDoYYYYLocales).forEach(function(locale) {
            var translationsKey = MMMMDoYYYYLocales[locale];

            moment.locale(locale, {
                calendar: {
                    lastDay: '[' + translate('YESTERDAY', translationsKey).sentenceCase() + ']',
                    sameDay: '[' + translate('TODAY', translationsKey).sentenceCase() + ']',
                    nextDay: '[' + translate('TOMORROW', translationsKey).sentenceCase() + ']',
                    lastWeek : 'MMMM D',
                    nextWeek : 'MMMM Do YYYY',
                    sameElse : 'MMMM Do YYYY'
                }
            });
        });

        moment.locale('es', {
            calendar : {
                lastDay : '[' + translate('YESTERDAY', 'spanish').sentenceCase() + ']',
                sameDay : '[' + translate('TODAY', 'spanish').sentenceCase() + ']',
                nextDay : '[' + translate('TOMORROW', 'spanish').sentenceCase() + ']',
                lastWeek : 'D [de] MMMM',
                nextWeek : 'D [de] MMMM [de] YYYY',
                sameElse : 'D [de] MMMM [de] YYYY'
            }
        });

        var DMMMMYYYYLocales = {
            'ru': 'russian',
            'fr': 'french',
            'nl': 'dutch'
        };
        Object.keys(DMMMMYYYYLocales).forEach(function(locale) {
            var translationsKey = DMMMMYYYYLocales[locale];

            moment.locale(locale, {
                calendar: {
                    lastDay: '[' + translate('YESTERDAY', translationsKey).sentenceCase() + ']',
                    sameDay: '[' + translate('TODAY', translationsKey).sentenceCase() + ']',
                    nextDay: '[' + translate('TOMORROW', translationsKey).sentenceCase() + ']',
                    lastWeek: 'YYYY-MM-DD',
                    nextWeek: 'YYYY-MM-DD',
                    sameElse: 'YYYY-MM-DD'
                }
            });
        });

        var yyyymmddLocales = {
            'zh-cn': 'chinese',
            'sw': 'swahili',
            'ar': 'arabic',
            'hi': 'hindi'
        };
        Object.keys(yyyymmddLocales).forEach(function(locale) {
            var translationsKey = yyyymmddLocales[locale];

            moment.locale(locale, {
                calendar: {
                    lastDay: '[' + translate('YESTERDAY', translationsKey).sentenceCase() + ']',
                    sameDay: '[' + translate('TODAY', translationsKey).sentenceCase() + ']',
                    nextDay: '[' + translate('TOMORROW', translationsKey).sentenceCase() + ']',
                    lastWeek: 'YYYY-MM-DD',
                    nextWeek: 'YYYY-MM-DD',
                    sameElse: 'YYYY-MM-DD'
                }
            });
        });
    });

angular.module('blocktrail.wallet').config(
    function($compileProvider, $stateProvider, $urlRouterProvider, $logProvider, $analyticsProvider, $sceDelegateProvider, CONFIG) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|bitcoin):/);
        $analyticsProvider.firstPageview(false);
        $logProvider.debugEnabled(CONFIG.DEBUG);

        var urlWhitelist = ['self'];

        if (CONFIG.CDN) {
            urlWhitelist.push(CONFIG.CDN + "**");
        }

        $sceDelegateProvider.resourceUrlWhitelist(urlWhitelist);

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
                templateUrl: "templates/setup/setup.html",
                resolve: {
                    /**
                     * check for extra languages to enable
                     * if new language is new preferred, set it
                     */
                    preferredLanguage: function(CONFIG, $rootScope, settingsService, blocktrailLocalisation, launchService) {
                        return launchService.getWalletConfig()
                            .then(function(result) {
                                return result.extraLanguages.concat(CONFIG.EXTRA_LANGUAGES).unique();
                            })
                            .then(function(extraLanguages) {
                                return settingsService.$isLoaded().then(function() {
                                    // parse extra languages to determine if there's any new
                                    var r = blocktrailLocalisation.parseExtraLanguages(extraLanguages);
                                    var preferredLanguage;

                                    // if there's any new we should store those
                                    if (r) {
                                        var newLanguages = r[0];
                                        preferredLanguage = r[1];
                                        settingsService.extraLanguages = settingsService.extraLanguages.concat(newLanguages).unique();
                                    } else {
                                        preferredLanguage = blocktrailLocalisation.setupPreferredLanguage();
                                    }

                                    // activate preferred language
                                    $rootScope.changeLanguage(preferredLanguage);

                                    // store preferred language
                                    settingsService.language = preferredLanguage;

                                    return settingsService.$store();
                                });
                            })
                            .then(function() {
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

            /*--- Buy BTC ---*/
            .state('app.wallet.buybtc', {
                url: "/buy",
                abstract: true,
                template: "<div ui-view></div>"
            })
            .state('app.wallet.buybtc.choose', {
                url: "/choose",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/buybtc/buybtc.choose.html",
                        controller: 'BuyBTCChooseCtrl'
                    }
                }
            })
            .state('app.wallet.buybtc.glidera_bitid_callback', {
                url: "/glidera/bitid/callback",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/buybtc/buybtc.glidera_callback.html",
                        controller: 'BuyBTCGlideraBitIDCallbackCtrl'
                    }
                }
            })
            .state('app.wallet.buybtc.glidera_oauth2_callback', {
                url: "/glidera/oaoth2/callback",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/buybtc/buybtc.glidera_callback.html",
                        controller: 'BuyBTCGlideraOauthCallbackCtrl'
                    }
                }
            })
            .state('app.wallet.buybtc.buy', {
                url: "/buy?broker",
                views: {
                    "mainView@app.wallet": {
                        templateUrl: "templates/buybtc/buybtc.buy.html",
                        controller: 'BuyBTCBuyCtrl'
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
        $urlRouterProvider.otherwise('/setup/login');
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

function parseQuery(url) {
    url = (url || "").split("?");
    if (url.length < 2) {
        return {};
    }
    var qstr = url[1];
    var query = {};
    var a = qstr.split('&');
    for (var i = 0; i < a.length; i++) {
        var b = a[i].split('=');
        query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
    }
    return query;
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

window.Qwaterfall = function(fns, arg) {
    var p = Q.when(arg);

    fns.slice().forEach(function(fn) {
        p = p.then(function(arg) {
            return fn(arg);
        });
    });

    return p;
};
