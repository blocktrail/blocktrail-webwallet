(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupWalletBackupCtrl", SetupWalletBackupCtrl);

    function SetupWalletBackupCtrl(backupInfo, $scope, $state, $translate, $log, bitcoinJS,
                                   setupService, sdkService, dialogService, launchService, CONFIG, walletsManagerService) {

        $scope.displayTextBackup = true;
        $scope.backupSaved = false;
        $scope.backupSavedCheck = false;
        $scope.working = false;
        $scope.qrSettings = {
            correctionLevel: 7,
            SIZE: 150,
            inputMode: "M",
            image: true
        };

        $scope.setupInfo.identifier = backupInfo.identifier;
        $scope.setupInfo.backupInfo = {
            walletVersion: backupInfo.walletVersion,
            encryptedPrimarySeed: backupInfo.encryptedPrimarySeed,
            encryptedSecret: backupInfo.encryptedSecret,
            backupSeed: backupInfo.backupSeed,
            recoveryEncryptedSecret: backupInfo.recoveryEncryptedSecret,
            supportSecret: backupInfo.supportSecret
        };

        // hacky, we asume that user won't click generate backup before this promise is finished
        if (!$scope.setupInfo.backupInfo.blocktrailPublicKeys) {
            sdkService.sdk().then(function(sdk) {
                $scope.setupInfo.backupInfo.blocktrailPublicKeys = {};
                angular.forEach(backupInfo.blocktrailPublicKeys, function(pubkey, key) {
                    $scope.setupInfo.backupInfo.blocktrailPublicKeys[pubkey.keyIndex] = bitcoinJS.HDNode.fromBase58(pubkey.pubKey, sdk.network);
                });
            });
        }

        $scope.backupPageError  = false;

        $scope.export = function() {
            var extraInfo = [];

            setupService.getUserInfo().then(function(userInfo) {
                if (userInfo.username) {
                    extraInfo.push({title: "Username", value: userInfo.username});
                }
                if (userInfo.email) {
                    extraInfo.push({title: "Email", value: userInfo.email});
                }
                if ($scope.setupInfo.backupInfo.supportSecret) {
                    extraInfo.push({
                        title: "Support Secret",
                        subtitle: "this can be shared with helpdesk to proof ownership of backup document",
                        value: $scope.setupInfo.backupInfo.supportSecret
                    });
                }

                var backup = new sdkService.BackupGenerator(
                    $scope.setupInfo.identifier,
                    $scope.setupInfo.backupInfo,
                    extraInfo,
                    {network: CONFIG.NETWORK_LONG}
                );

                try {
                    backup.generatePDF(function(err, pdf) {
                        if (err) {
                            $log.error(err);
                            dialogService.alert(err, $translate.instant("ERROR"), $translate.instant("OK"));
                        } else {
                            $scope.backupSaved = true;
                            $scope.backupPDF = pdf;
                            $scope.backupPDF.save("BTC.com " + CONFIG.NETWORK_LONG + " Wallet Recovery Backup Sheet - " + $scope.setupInfo.identifier + ".pdf");
                        }
                    });
                } catch (error) {
                    $log.error("Backup generation error", error);
                }
            });
        };

        $scope.continue = function() {
            if ($scope.working) {
                return;
            }

            $scope.working = true;

            if (!$scope.backupSaved || !$scope.backupSavedCheck) {
                $scope.backupPageError = $translate.instant("SETUP_WALLET_BACKUP_CHECKBOX");
            } else {
                // delete all temp backup info
                launchService.clearBackupInfo()
                    .then(function() {
                        return launchService.getWalletInfo().then(function(walletInfo) {
                            return walletsManagerService.setActiveWalletById(walletInfo.identifier);
                        })
                    })
                    .then(function() {
                        $state.go('app.wallet.summary');
                    })
                ;
            }
        };
    }
})();
