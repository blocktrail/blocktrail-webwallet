(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('passwordRecoveryService', PasswordRecoveryService);
    
    function PasswordRecoveryService($http, CONFIG, dialogService, cryptoJS, $translate) {

        function requestRecoveryMail(email) {
            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/recovery/request-link", { email: email, captcha : window.captchaToken} );
        }

        function requestRecoverySecret(token) {
            return $http.post(CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/recovery/request-recovery-secret", { token: token }).then(function (res) {
                if (res.data && res.data.recovery_secret) {
                    return res.data.recovery_secret;
                }
            }, function (err) {
                dialogService.alert(
                    $translate.instant("RECOVERY_ERROR"),
                    $translate.instant("MSG_REQUEST_RECOVERY_SECRET_FAILED"),
                    false, false
                );

                throw err;
            });
        }

        function encryptSecretWithPassword(secret, password, walletVersion) {
            var newEncryptedSecret;
            var newEncryptedSecretMnemonic;
            var newPasswordHash;
            var newPasswordBuffer = null;

            console.log("encryptSecretWithPassword secret:",secret);
            console.log("encryptSecretWithPassword password:",password);
            console.log("Starting encryptSecretWithPassword, the wallet version:",walletVersion);
            if (walletVersion === blocktrailSDK.Wallet.WALLET_VERSION_V2) {
                newEncryptedSecret = cryptoJS.AES.encrypt(secret.toString(), password).toString(cryptoJS.format.OpenSSL);
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

            newPasswordHash = cryptoJS.SHA512(password).toString();

            return {
                password_hash: newPasswordHash,
                encrypted_secret: newEncryptedSecret,
                secret_mnemonic: newEncryptedSecretMnemonic
            }
        }

        function decryptSecretMnemonicWithPasswordV3(encryptedSecretMnemonic, password) {
            var encryptedRecoverySecret = blocktrailSDK.EncryptionMnemonic.decode(encryptedSecretMnemonic);
            var secret = blocktrailSDK.Encryption.decrypt(encryptedRecoverySecret, new blocktrailSDK.Buffer(password, 'hex'));

            return secret;
        }

        function decryptSecretMnemonicWithPasswordV2(encryptedSecretMnemonic, password) {
            var encryptedRecoverySecret = blocktrailSDK.convert(blocktrailSDK.bip39.mnemonicToEntropy(encryptedSecretMnemonic), 'hex', 'base64');
            var secret = new blocktrailSDK.Buffer(cryptoJS.AES.decrypt(encryptedRecoverySecret, password).toString(cryptoJS.enc.Utf8), 'hex');

            return secret;
        }

        function decryptSecretMnemonicWithPassword(encryptedSecretMnemonic, password, walletVersion) {
            var eV3;

            /*try {
                return [decryptSecretMnemonicWithPasswordV3(encryptedSecretMnemonic, password), blocktrailSDK.Wallet.WALLET_VERSION_V3];
            } catch (_eV3) {
                console.log('decryptSecretMnemonicWithPasswordV3 ERR', _eV3);
                eV3 = _eV3;
            }*/

            try {
                return [decryptSecretMnemonicWithPasswordV3(encryptedSecretMnemonic, password), blocktrailSDK.Wallet.WALLET_VERSION_V3];
            } catch (_eV3) {
                console.log('decryptSecretMnemonicWithPasswordV3 ERR', _eV3);
                eV3 = _eV3;
                console.log('try decryptSecretMnemonicWithPasswordV2...');
                try {
                    return [decryptSecretMnemonicWithPasswordV2(encryptedSecretMnemonic, password), blocktrailSDK.Wallet.WALLET_VERSION_V2];
                } catch (_eV2) {
                    console.log('decryptSecretMnemonicWithPasswordV2 ERR', _eV2);
                }
            }

            throw new Error("Failed to decrypt; error: " + eV3);
        }

        return {
            requestRecoveryMail: requestRecoveryMail,
            requestRecoverySecret: requestRecoverySecret,
            encryptSecretWithPassword: encryptSecretWithPassword,
            decryptSecretMnemonicWithPassword: decryptSecretMnemonicWithPassword
        };
    }

})();
