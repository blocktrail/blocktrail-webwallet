angular.module('blocktrail.wallet').factory(
    'launchService',
    function(storageService, $q, $log, $http, CONFIG, sdkService) {
        var LaunchService = function() {
            var self = this;

            self.storage = storageService.db('launch');
            self._accountInfo = null;
            self._walletInfo = null;
            self._backupInfo = null;
            self._walletConfig = null;
        };

        LaunchService.prototype.getWalletConfig = function() {
            var self = this;

            if (!self._walletConfig || (self._walletConfig.ts > (new Date()).getTime() + (600 * 1000))) {
                self._walletConfig = self.getAccountInfo(true)
                    .catch(function() {
                        return {};
                    })
                    .then(function(accountInfo) {
                        var url = CONFIG.API_URL + "/v1/" + CONFIG.API_NETWORK + "/mywallet/config?";
                        var params = [
                            "v=" + (CONFIG.VERSION || ""),
                            "platform=web"
                        ];

                        if (accountInfo && accountInfo.api_key) {
                            params.push("api_key=" + accountInfo.api_key);
                        }

                        return $http.get(url + params.join("&"))
                            .then(function(result) {
                                return result.data;
                            });
                    });

                self._walletConfig.ts = (new Date()).getTime();
            }

            return self._walletConfig;
        };

        LaunchService.prototype.handleSetupState = function(currentState, $state, $stateParams) {
            var self = this;

            return self.determineSetupState().then(
                function(setupState) {
                    var isAllowed = !!setupState.allowed.any(function(allowedState) {
                        return currentState.indexOf(allowedState) === 0;
                    });

                    $log.debug('handleSetupState ' + [currentState, isAllowed].join(";"));

                    console.log(currentState, setupState._default);

                    if (currentState === 'app.setup.verifyEmail' && setupState._default === 'app.wallet.summary') {
                        $state.go('app.wallet.verifyEmail', $stateParams);
                        return true;
                    }

                    if (!isAllowed) {
                        $state.go(setupState._default);
                    }
                    return true;
                }
            );
        };

        LaunchService.prototype.determineSetupState = function() {

            var self = this;

            return self.getAccountInfo(true).then(
                function(accountInfo) {
                    sdkService.setAccountInfo(accountInfo);

                    return self.getWalletInfo(true).then(
                        function(walletInfo) {
                            return self.getBackupInfo(true).then(
                                function(backupInfo) {
                                    // backupInfo found, means it still needs to be saved (because after that it's unset)
                                    return {
                                        allowed: ['app.setup.walletBackup'],
                                        _default: 'app.setup.walletBackup'
                                    };
                                },
                                function() {
                                    // no backupInfo found, means it has already been saved
                                    return {
                                        allowed: [
                                            'app.wallet',
                                            'app.wallet.verifyEmail'
                                        ],
                                        _default: 'app.wallet.summary'
                                    };
                                }
                            );
                        },
                        function() {
                            // no walletInfo found, means wallet needs to be created
                            // however unless specifically navigated to app.setup.wallet we just go back to the login
                            return {
                                allowed: [
                                    'app.setup.verifyEmail',
                                    'app.setup.wallet',
                                    'app.setup.login',
                                    'app.setup.register',
                                    'app.setup.loggedout',
                                    'app.setup.forgotPassword',
                                    'app.setup.changePassword'
                                ],
                                _default: 'app.setup.login'
                            };
                        }
                    );
                }
            )
                // fallback, but should only really happen when accountInfo is not set yet
                .catch(function() {
                    return {
                        allowed: ['app.setup.login', 'app.setup.register', 'app.setup.loggedout', 'app.core.verifyEmail'],
                        _default: 'app.setup.login'
                    };

                })
            ;
        };

        LaunchService.prototype.getAccountInfo = function(useCached) {
            var self = this;

            if (!useCached || !self._accountInfo) {
                self._accountInfo = $q.when(self.storage.get('account_info'))
                    .then(function(doc) {
                        return doc;
                    }, function() {
                        self._accountInfo = null;
                    })
                ;
            }

            return self._accountInfo;
        };

        LaunchService.prototype.storeAccountInfo = function(accountInfo) {
            var self = this;

            self._accountInfo = null;

            return $q.when(self.storage.get('account_info'))
                .then(function(doc) { return doc; }, function() { return {_id: "account_info"}; })
                .then(function(doc) {
                    doc.username = accountInfo.username;
                    doc.email = accountInfo.email;
                    doc.api_key = accountInfo.api_key;
                    doc.api_secret = accountInfo.api_secret;
                    doc.testnet = accountInfo.testnet;
                    doc.secret = accountInfo.secret;
                    doc.requires2FA = typeof accountInfo.requires_2fa !== "undefined" ? accountInfo.requires_2fa : accountInfo.requires2FA;

                    return self.storage.put(doc).then(function() {
                        return doc;
                    });
                }
            );
        };

        LaunchService.prototype.updateAccountInfo = function(updateAccountInfo) {
            var self = this;

            return self.getAccountInfo().then(function(accountInfo) {
                Object.keys(updateAccountInfo).forEach(function(k) {
                    accountInfo[k] = updateAccountInfo[k];
                });

                return self.storeAccountInfo(accountInfo);
            });
        };

        LaunchService.prototype.clearAccountInfo = function() {
            var self = this;

            self._accountInfo = null;

            return $q.when(self.storage.get('account_info'))
                .then(function(doc) {
                    return self.storage.remove(doc);
                }, function() {
                    return true;
                })
            ;
        };

        LaunchService.prototype.getWalletInfo = function(useCached) {
            var self = this;

            if (!useCached || !self._walletInfo) {
                self._walletInfo = $q.when(self.storage.get('wallet_info'))
                    .then(function(doc) {
                        return doc;
                    })
                ;
            }

            return self._walletInfo;
        };

        LaunchService.prototype.storeWalletInfo = function(identifier, networkType) {
            var self = this;

            self._walletInfo = null;

            return $q.when(self.storage.get('wallet_info'))
                .then(function(doc) { return doc; }, function() { return {_id: "wallet_info"}; })
                .then(function(doc) {
                        doc.identifier = identifier;
                        doc.networkType = networkType;

                        return self.storage.put(doc).then(function() {
                            return true;
                        });
                    }
                );
        };

        var walletSecret = null;
        LaunchService.prototype.stashWalletSecret = function(secret) {
            walletSecret = secret;
        };

        LaunchService.prototype.getWalletSecret = function() {
            var secret = walletSecret;
            walletSecret = null;

            return secret;
        };

        LaunchService.prototype.clearWalletInfo = function() {
            var self = this;

            self._walletInfo = null;

            return $q.when(self.storage.get('wallet_info'))
                .then(function(doc) {
                    return self.storage.remove(doc);
                }, function() {
                    return true;
                })
            ;
        };

        LaunchService.prototype.getBackupInfo = function(useCached) {
            var self = this;

            if (!useCached || !self._backupInfo) {
                self._backupInfo = $q.when(self.storage.get('wallet_backup'))
                    .then(function(doc) {
                        return doc;
                    })
                ;
            }

            return self._backupInfo;
        };

        LaunchService.prototype.storeBackupInfo = function(walletInfo) {
            var self = this;

            self._backupInfo = null;

            return $q.when(self.storage.get('wallet_backup'))
                .then(function(doc) { return doc; }, function() { return {_id: "wallet_backup"}; })
                .then(function(doc) {
                    doc.identifier = walletInfo.identifier;
                    doc.walletVersion = walletInfo.walletVersion || null;
                    doc.encryptedPassword = walletInfo.encryptedPassword || null;
                    doc.encryptedPrimarySeed = walletInfo.encryptedPrimarySeed;
                    doc.backupSeed = walletInfo.backupSeed;
                    doc.encryptedSecret = walletInfo.encryptedSecret;
                    doc.recoveryEncryptedSecret = walletInfo.recoveryEncryptedSecret;
                    doc.blocktrailPublicKeys = walletInfo.blocktrailPublicKeys;
                    doc.supportSecret = walletInfo.supportSecret;

                    return self.storage.put(doc).then(function() {
                        return doc;
                    });
                }
            );
        };

        LaunchService.prototype.clearBackupInfo = function() {
            var self = this;

            self._backupInfo = null;

            return $q.when(self.storage.get('wallet_backup'))
                .then(function(doc) {
                    return self.storage.remove(doc);
                }, function() {
                    return true;
                })
            ;
        };

        return new LaunchService();

    }
);
