angular.module('blocktrail.wallet').factory(
    'AppVersionService',
    function(AppVersionBaseService, $q, $translate, $timeout, $rootScope, $state, settingsService, CONFIG, dialogService, $sce, $filter) {
        var _CHECKS = AppVersionBaseService.CHECKS;
        var isCheck = AppVersionBaseService.isCheck;

        // priority order, first one met is used (allows older version update messages to be prioritized when a user jumps multiple versions)
        var UPDATE_MESSAGES = [
            ["3.4.7", "UPDATE_NOTICE_030407"],
            ["3.3.4", "UPDATE_NOTICE_030304"]
        ].clean();

        var CHECKS = {
            SETUP: 0,
            LOGGEDIN: _CHECKS.UPDATED
        };

        var checkVersion = function(latestVersion, versionInfo, checks) {
            var results = AppVersionBaseService.checkVersion(latestVersion, versionInfo, checks, UPDATE_MESSAGES);
            if (results) {
                var match = results[0];
                var meta = results.length > 1 ? results[1] : null;

                if (match === _CHECKS.UPDATED) {
                    if (meta) {
                        dialogService.alert({
                            bodyHtml: $filter('nl2br')($translate.instant(meta)),
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
