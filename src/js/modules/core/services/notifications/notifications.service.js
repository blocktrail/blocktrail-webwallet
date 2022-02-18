(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('NotificationsService', NotificationsService);

    function NotificationsService(CONFIG, dialogService, settingsService, $translate, $log,$sce) {

        var settingsData = settingsService.getReadOnlySettingsData();

        function checkAndPromptSimplex() {
            var currTimestamp = ((new Date()).getTime() / 1000).toFixed(0);
            var simplexLastForward = settingsData.simplexLastForward;

            if (currTimestamp - simplexLastForward < settingsData.simplexLastForwardDelta) {
                return dialogService.alert(
                    $translate.instant('IMPORTANT'),
                    'You\'ve been back here quite fast, are you sure you completed the whole checkout?', // $translate.instant('BROWSER_SECURITY_ERROR'),
                    $translate.instant('OK')
                ).result;
            }
        }

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
         function announcementPromit(timer){
           var currentDate = Date.now()
           if(!localStorage.getItem('date')){
            localStorage.setItem('date',currentDate)
           }

           if((currentDate - localStorage.getItem('date') >= 4*1000*60*60) || currentDate===Number(localStorage.getItem('date'))){
            console.log(4*1000*60*60 - currentDate + localStorage.getItem('date'),2222)
            dialogService.alert(
              {
                title: $translate.instant('WALL_ANNOUNCEMENT_DIALOG'),
                bodyHtml: $sce.trustAsHtml($translate.instant('WALL_ANNOUNCEMENT_INFO')+'<a href="/#/announcement" target="_blank">'+$translate.instant('WALL_ANNOUNCEMENT_VIEW')+'</a>'),
                ok: $translate.instant('OK')
            }
           ).result.then(function(){
              localStorage.setItem('date',Date.now())
              setTimeout(function(){
              announcementPromit()
           },4*1000*60*60)
           })
           }
           else{
             console.log(4*1000*60*60 -(Date.now() - localStorage.getItem('date')),1111)
             clearTimeout(localStorage.getItem('timer'))
             const timer=setTimeout(function(){
               
              dialogService.alert(
                {
                  title: $translate.instant('WALL_ANNOUNCEMENT_DIALOG'),
                  bodyHtml: $sce.trustAsHtml($translate.instant('WALL_ANNOUNCEMENT_INFO')+'<a href="/#/announcement" target="_blank">'+$translate.instant('WALL_ANNOUNCEMENT_VIEW')+'</a>'),
                  ok: $translate.instant('OK')
              }
             ).result.then(function(){
                localStorage.setItem('date',Date.now())
                setTimeout(function(){
                announcementPromit()
             },4*1000*60*60)
             })
             }, 4*1000*60*60 -(currentDate - localStorage.getItem('date')))
             localStorage.setItem('timer',timer)
           }
            
            
        }

        return {
            checkAndPromptSimplex: checkAndPromptSimplex,
            checkAndPromptBitcoinURIHandler: checkAndPromptBitcoinURIHandler,
            promptBitcoinURIHandler: promptBitcoinURIHandler,
            announcementPromit:announcementPromit 
        };
    }

})();
