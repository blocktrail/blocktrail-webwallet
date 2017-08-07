(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('passwordRecoveryService', PasswordRecoveryService);
    
    function PasswordRecoveryService($http, CONFIG, dialogService) {

        function requestRecoveryMail(email) {
            return $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "tBTC" : "BTC") + "/recovery/request-link", { email: email } );
        }

        function requestRecoverySecret(token) {
            return $http.post(CONFIG.API_URL + "/v1/" + (CONFIG.TESTNET ? "tBTC" : "BTC") + "/recovery/request-recovery-secret", { token: token }).then(function (res) {
                if (res.data && res.data.recovery_secret) {
                    return res.data.recovery_secret;
                }
            }, function (err) {
                dialogService.alert(
                    $translate.instant("RECOVERY_ERROR"),
                    $translate.instant("MSG_PASSWORD_NOT_CHANGED")
                );

                throw err;
            });
        }

        function encryptSecretWithPassword(secret, password, walletVersion) {
            var newEncryptedSecret;
            var newEncryptedSecretMnemonic;
            var newPasswordHash;
            var newPasswordBuffer = null;

            if (walletVersion === blocktrailSDK.Wallet.WALLET_VERSION_V2) {
                newEncryptedSecret = blocktrailSDK.CryptoJS.AES.encrypt(secret, password).toString(blocktrailSDK.CryptoJS.format.OpenSSL);
                newEncryptedSecretMnemonic = blocktrailSDK.bip39.entropyToMnemonic(blocktrailSDK.convert(newEncryptedSecret, 'base64', 'hex'));
            } else {
                if (!(typeof password === "string")) {
                    throw new Error('New password must be provided as a string');
                }

                newPasswordBuffer = new blocktrailSDK.Buffer(password);
                newEncryptedSecret = blocktrailSDK.Encryption.encrypt(secret, newPasswordBuffer);
                newEncryptedSecretMnemonic = blocktrailSDK.EncryptionMnemonic.encode(newEncryptedSecret);
                // It's a buffer, so convert it back to base64
                newEncryptedSecret = newEncryptedSecret.toString('base64');
            }

            newPasswordHash = blocktrailSDK.CryptoJS.SHA512(password).toString();

            return {
                password_hash: newPasswordHash,
                encrypted_secret: newEncryptedSecret,
                secret_mnemonic: newEncryptedSecretMnemonic
            }
        }

        function decryptSecretMnemonicWithPassword(encryptedSecretMnemonic, password, walletVersion) {
            var encryptedRecoverySecret = null;
            var secret = null;

            if (walletVersion === 'v3') {
                encryptedRecoverySecret = blocktrailSDK.EncryptionMnemonic.decode(encryptedSecretMnemonic);
                secret = blocktrailSDK.Encryption.decrypt(encryptedRecoverySecret, new blocktrailSDK.Buffer(password, 'hex'));
            } else {
                encryptedRecoverySecret = blocktrailSDK.convert(blocktrailSDK.bip39.mnemonicToEntropy(encryptedSecretMnemonic), 'hex', 'base64');
                secret = CryptoJS.AES.decrypt(encryptedRecoverySecret, password).toString(CryptoJS.enc.Utf8);
            }

            return secret;
        }

        return {
            requestRecoveryMail: requestRecoveryMail,
            requestRecoverySecret: requestRecoverySecret,
            encryptSecretWithPassword: encryptSecretWithPassword,
            decryptSecretMnemonicWithPassword: decryptSecretMnemonicWithPassword
        };
    }

})();
