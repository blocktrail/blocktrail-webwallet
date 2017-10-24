(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('NotificationsService', NotificationsService);

    function NotificationsService(CONFIG, dialogService, settingsService, $translate, $log) {

        var settingsData = settingsService.getReadOnlySettingsData();

        function checkAndPromptBitcoinURIHandler() {

            var currTimestamp = ((new Date()).getTime() / 1000).toFixed(0);
            var currNotifyCounter = settingsData.registerURIHandlerNotifyCounter;
            var currLastNotifyTimestamp = settingsData.registerURIHandlerNotifyTimestamp;

            // If it is time to show another notification, and register has not been attempted yet
            if (currNotifyCounter < settingsData.registerURIHandlerNotifyCounterMax &&
                currTimestamp - currLastNotifyTimestamp > settingsData.registerURIHandlerNotifyTimestampDelta &&
                !settingsData.registerURIHandlerExecuted) {
                // Bump notify counter AND timestamp of notify
                settingsService.updateSettingsUp({
                    registerURIHandlerNotifyCounter: currNotifyCounter + 1,
                    registerURIHandlerNotifyTimestamp: currTimestamp
                }).then(function() {
                    // Prompt user about this feature
                    return promptBitcoinURIHandler(true).result.then(function() {
                        settingsService.updateSettingsUp({
                            registerURIHandlerExecuted: true
                        }).then(function () {
                            try {
                                $log.log('Trying to register bitcoin URI scheme');
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
                    });
                });
            }
        }

        function promptBitcoinURIHandler(settingsNote) {
            return dialogService.alert(
                $translate.instant('MAKE_DEFAULT_BROWSER_WALLET'),
                $translate.instant('MAKE_DEFAULT_BROWSER_WALLET_DETAILS')
                + (settingsNote ? ' ' + $translate.instant('DO_THIS_LATER_IN_SETTINGS') : '')
                + (isChrome()   ? ' ' + $translate.instant('MAKE_DEFAULT_BROWSER_WALLET_DETAILS_CHROME') : ''),
                $translate.instant('YES'),
                $translate.instant('NO')
            );
        }

        function isChrome() {
            return navigator.userAgent.match(/Chrome\/\d+/) !== null;
        }

        return {
            checkAndPromptBitcoinURIHandler: checkAndPromptBitcoinURIHandler,
            promptBitcoinURIHandler: promptBitcoinURIHandler
        };
    }

})();
