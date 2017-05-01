angular.module('blocktrail.wallet').factory(
    'AppVersionService',
    function(AppVersionBaseService, $translate, $rootScope, $state, settingsService, CONFIG, dialogService) {
        var _CHECKS = AppVersionBaseService.CHECKS;
        var isCheck = AppVersionBaseService.isCheck;

        var GLIDERA_VERSION = 'v3.0.0';

        // priority order, first one met is used (allows older version update messages to be prioritized when a user jumps multiple versions)
        var UPDATE_MESSAGES = [
            // ["0.0.0", "EXAMPLE"]
        ];

        var checkGlideraActivated = function() {
            // only do the check if buybtc is activated and we're in loggedin state
            if (CONFIG.BUYBTC && $state.includes('app.wallet')) {
                return settingsService.$isLoaded().then(function () {
                    var p;

                    if (settingsService.glideraActivationNoticePending) {
                        settingsService.glideraActivationNoticePending = false;
                        p = settingsService.$store().then(function () {
                            return settingsService.$syncSettingsUp();
                        });

                        dialogService.alert({
                            body: $translate.instant('WEBWALLET_UPDATE_030100'),
                            title: $translate.instant('UPDATED_NOTICE')
                        });
                    }

                    return p;
                });
            }
        };

        checkGlideraActivated();

        var CHECKS = {
            SETUP: 0,
            LOGGEDIN: _CHECKS.UPDATED
        };

        var checkVersion = function(latestVersion, versionInfo, checks) {
            // if this version of the app supports glidera and it's new we glideraActivationNoticePending=true so that when glidera is activated we can display update notice
            //  this is a special case because glidera is pending server activation
            if (latestVersion && isCheck(checks, _CHECKS.UPDATED) && $state.includes('app.wallet') && semver.lt(latestVersion, GLIDERA_VERSION)) {
                settingsService.$isLoaded().then(function() {
                    if (settingsService.glideraActivationNoticePending === null) {
                        settingsService.glideraActivationNoticePending = true;
                        settingsService.$store()
                            .then(function () {
                                return settingsService.$syncSettingsUp();
                            })
                            .then(function () {
                                return checkGlideraActivated();
                            });
                    }
                });
            }

            var results = AppVersionBaseService.checkVersion(latestVersion, versionInfo, checks, UPDATE_MESSAGES);
            if (results) {
                var match = results[0];
                var meta = results.length > 1 ? results[1] : null;

                if (match === _CHECKS.UPDATED) {
                    if (meta) {
                        dialogService.alert({
                            body: $translate.instant(meta),
                            title: $translate.instant('UPDATED_NOTICE')
                        });
                    }
                }
            }
        };

        return {
            CHECKS: CHECKS,
            checkVersion: checkVersion
        };
    }
)
    .factory(
        'AppVersionBaseService',
        function($translate, $log, CONFIG) {
            var CHECKS = {
                DEPRECATED: 1 << 0,
                OUTDATED: 1 << 1,
                UPDATED: 1 << 2,
                UNSUPPORTED: 1 << 3
            };

            // shortcuts
            CHECKS.SETUP = CHECKS.DEPRECATED | CHECKS.UNSUPPORTED;
            CHECKS.LOGGEDIN = CHECKS.DEPRECATED | CHECKS.UNSUPPORTED | CHECKS.OUTDATED | CHECKS.UPDATED;

            var isCheck = function(checks, check) {
                return (checks & check) === check;
            };

            var checkVersion = function(latestVersion, versionInfo, checks, UPDATE_MESSAGES) {
                $log.debug('latestVersion: ' + latestVersion);
                $log.debug('versionInfo: ' + JSON.stringify(versionInfo, null, 4));

                if (isCheck(checks, CHECKS.UNSUPPORTED)) {
                    if (versionInfo.unsupported && semver.lte(CONFIG.VERSION, versionInfo.unsupported)) {
                        return [CHECKS.UNSUPPORTED];
                    }
                }

                if (isCheck(checks, CHECKS.DEPRECATED)) {
                    if (versionInfo.deprecated && semver.lte(CONFIG.VERSION, versionInfo.deprecated)) {
                        return [CHECKS.DEPRECATED];
                    }
                }

                if (isCheck(checks, CHECKS.OUTDATED)) {
                    if (versionInfo.latest && semver.lt(CONFIG.VERSION, versionInfo.latest)) {
                        return [CHECKS.OUTDATED];
                    }
                }

                if (isCheck(checks, CHECKS.UPDATED) && UPDATE_MESSAGES) {
                    if (latestVersion) {
                        if (semver.lt(latestVersion, CONFIG.VERSION)) {
                            var updateMsg;
                            UPDATE_MESSAGES.forEach(function(_updateMsg) {
                                if (!updateMsg && semver.gt(_updateMsg[0], latestVersion)) {
                                    updateMsg = _updateMsg;
                                }
                            });

                            return [CHECKS.UPDATED, updateMsg && updateMsg[1]];
                        }
                    }
                }
            };

            return {
                CHECKS: CHECKS,
                isCheck: isCheck,
                checkVersion: checkVersion
            };
        }
    );
