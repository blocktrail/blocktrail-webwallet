angular.module('blocktrail.wallet')
    .controller('LaunchCtrl', function($state, launchService, settingsService) {
        launchService.getAccountInfo()
            .then(function(accountInfo) {
                return launchService.getWalletInfo()
                    .then(function(walletInfo) {
                        // wallet is set up, check rest of setup progress
                        return settingsService.$isLoaded()
                            .then(function() {
                                // if setup not complete, go to relevant step
                                if (settingsService.setupComplete) {
                                    $state.go('app.wallet.summary');
                                } else /* if (!settingsService.backupSaved) */ {
                                    // backup saving
                                    $state.go('app.setup.backup');
                                }
                            })
                        ;
                    }, function() {
                        // no wallet info yet, go to register
                        $state.go('app.setup.wallet');
                    })
                ;
            }, function() {
                // no wallet yet, go to start
                $state.go('app.setup.register');
            });
    });

angular.module('blocktrail.wallet')
    .controller('ResetCtrl', function($state, storageService) {
        storageService.resetAll().then(
            function() {
                alert('reset!');
                window.location.replace('/');
            }
        );
    });


angular.module('blocktrail.wallet')
    .controller('LogoutCtrl', function($state, storageService) {
        storageService.resetAll().then(
            function() {
                window.location.replace('/#/setup/login');
                window.location.reload(true);
            }
        );
    });
