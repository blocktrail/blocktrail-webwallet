angular.module('blocktrail.wallet').factory(
    'glideraService',
    function(CONFIG, $log, $q, walletsManagerService, dialogService, $state, $rootScope, $translate, $http, _,
             $timeout, $interval, settingsService, launchService, sdkService, trackingService) {

        // TODO Review !
        var activeWallet = walletsManagerService.getActiveWallet();
        var clientId;
        var returnuri = CONFIG.WALLET_URL + "/#/wallet/buy/glidera/oaoth2/callback";
        var decryptedAccessToken = null;
        var DECRYPTED_TOKEN_TTL = 30 * 60 * 1000; // 30min

        var GLIDERA_ERRORS = {
            INVALID_ACCESS_TOKEN: 2001,
            ACCESS_TOKEN_REVOKED: 2002
        };

        var encodeOpenURI = function(uri) {
            return uri.replace('#', '%23');
        };

        var setDecryptedAccessToken = function(accessToken) {
            $log.debug('setDecryptedAccessToken');
            decryptedAccessToken = accessToken;

            $timeout(function() {
                decryptedAccessToken = null;
            }, DECRYPTED_TOKEN_TTL); // 30min
        };

        var createRequest = function(options, accessToken, twoFactor) {
            options = options || {};
            var headers = {};
            if (accessToken) {
                headers['Authorization'] = 'Bearer ' + accessToken;
            }
            if (twoFactor) {
                headers['X-2FA-CODE'] = twoFactor;
            }

            options = _.defaults({}, (options || {}), {
                https: true,
                host: CONFIG.GLIDERA_URL.replace(/https?:\/\//, ''),
                endpoint: '/api/v1',
                params: {
                    platform: 'web'
                },
                headers: _.defaults({}, (options.headers || {}), headers),
                contentMd5: false
            });

            return new blocktrailSDK.Request(options);
        };

        var oauth2 = function() {
            settingsService.getSettings().then(function(settings) {
                var uuid = Math.ceil((new Date).getTime() / 1000);
                var scope = ['transact', 'transaction_history'].join(' ');
                var qs = [
                    'response_type=code',
                    'client_id=' + clientId,
                    'state=' + uuid,
                    'scope=' + scope,
                    'required_scope=' + scope,
                    'login_hint=' + (settings.email || "").replace(/\+.*@/, "@"), // name+label@mail.com isn't supported by glidera
                    'redirect_uri=' + returnuri
                ];

                var glideraUrl = CONFIG.GLIDERA_URL + "/oauth2/auth?" + qs.join("&");

                $log.debug('oauth2', glideraUrl);

                window.open(encodeOpenURI(glideraUrl), '_self');
            });
        };

        var setup = function() {
            return accessToken().then(function(accessToken) {
                var qs = [
                    'redirect_uri=' + returnuri,
                    'access_token=' + accessToken
                ];

                var glideraUrl = CONFIG.GLIDERA_URL + "/user/setup?" + qs.join("&");

                $log.debug('setup', glideraUrl);

                window.open(encodeOpenURI(glideraUrl), '_self');
            });
        };

        var handleOauthCallback = function(glideraCallback) {
            if (!glideraCallback) {
                return $q.reject(new Error("no glideraCallback"));
            }

            var spinner;

            return $q.when(glideraCallback)
                .then(function(glideraCallback) {
                    var qs = parseQuery(glideraCallback);

                    $log.debug('qs? ', JSON.stringify(qs, null, 4));

                    if (!qs.code) {
                        throw new Error(qs.error_message.replace("+", " "));
                    }

                    spinner = dialogService.spinner({title: 'WORKING'});

                    return sdkService.sdk().then(function(sdk) {
                        return sdk.glideraOauth(qs.code, returnuri)
                            .then(function(result) {
                                $log.debug('oauthtoken', JSON.stringify(result, null, 4));
                                trackingService.trackEvent(trackingService.EVENTS.BUYBTC.GLIDERA_SETUP_DONE);

                                var accessToken = result.access_token;
                                var glideraAccessToken = {
                                    scope: result.scope
                                };

                                return settingsService.getSettings().then(function(settings) {
                                    return dialogService.prompt({
                                        body: $translate.instant('MSG_BUYBTC_PASSWORD_TO_ENCRYPT'),
                                        title: $translate.instant('ENTER_CURRENT_PASSWORD'),
                                        input_type: 'password',
                                        icon: 'key'
                                    })
                                        .result
                                        .then(function(password) {
                                            return activeWallet.unlockWithPassword(password)
                                        })
                                        .then(function(wallet) {
                                            var secretBuf = wallet.secret;
                                            if (wallet.walletVersion === 'v2') {
                                                secretBuf = new blocktrailSDK.Buffer(secretBuf, 'hex');
                                            }
                                            var accessTokenBuf = new blocktrailSDK.Buffer(accessToken, 'utf8');
                                            glideraAccessToken.encryptedAccessToken = blocktrailSDK.Encryption.encrypt(
                                                accessTokenBuf, secretBuf, blocktrailSDK.KeyDerivation.subkeyIterations
                                            ).toString('base64');

                                            wallet.lock();
                                        })
                                        .then(function() {
                                            setDecryptedAccessToken(accessToken);

                                            var updateSettings = {
                                                glideraAccessToken: glideraAccessToken
                                            };

                                            return settingsService.updateSettingsUp(updateSettings)
                                                .then(updateAllTransactions.bind(this));
                                        })
                                    ;
                                })
                            })
                        ;
                    });
                })
                .then(function(result) { spinner.close(); return result; }, function(err) { if(spinner) { spinner.close(); } $log.log(err); throw err; })
            ;
        };

        var handleGlideraErr = function(err) {
            if (err.code === GLIDERA_ERRORS.ACCESS_TOKEN_REVOKED || err.code === GLIDERA_ERRORS.INVALID_ACCESS_TOKEN) {
                setDecryptedAccessToken(null);

                var updateSettings = {
                    glideraAccessToken: null
                };

                settingsService.updateSettingsUp(updateSettings)
                    .then(function () {
                        $state.go('app.wallet.buybtc.choose');
                    });

                return true;
            }

            return false;
        };

        var userCanTransact = function() {
            return settingsService.getSettings().then(function(settings) {
                if (!settings.glideraAccessToken) {
                    return false;
                }

                if (settings.glideraAccessToken.userCanTransact === true) {
                    return settings.glideraAccessToken.userCanTransact;
                }

                return accessToken().then(function(accessToken) {
                    if (!accessToken) {
                        return false;
                    }

                    var r = createRequest(null, accessToken);

                    return r.request('GET', '/user/status ', {}, null)
                        .then(function(result) {
                            $log.debug('status', JSON.stringify(result, null, 4));

                            return settingsService.getSettings().then(function(settings) {
                                settings.glideraAccessToken.userCanTransact = result.userCanTransact;
                                settings.glideraAccessToken.userCanTransactInfo = _.defaults({}, result.userCanTransactInfo);

                                var updateSettings = {
                                    glideraAccessToken: settings.glideraAccessToken
                                };

                                return settingsService.updateSettingsUp(updateSettings).then(function() {
                                    return result.userCanTransact;
                                });
                            });
                        }, function(err) {
                            if (handleGlideraErr(err)) {
                                return $q.reject('dismiss');
                            } else {
                                throw err;
                            }
                        })
                        ;
                });
            })
                .then(function(userCanTransact) { return userCanTransact; }, function(err) { $log.log(err); throw err; })
                ;
        };

        var twoFactor = function() {
            return twoFactorMode().then(function(twoFactorMode) {
                if (twoFactorMode === "NONE") {
                    return;
                } else {
                    return dialogService.prompt({
                        body: $translate.instant('MSG_BUYBTC_GLIDERA_2FA_BODY', {
                            mode: twoFactorMode
                        }),
                        title: $translate.instant('MSG_BUYBTC_GLIDERA_2FA_TITLE')
                    })
                    .result;
                }
            });
        };

        var twoFactorMode = function() {
            return settingsService.getSettings().then(function(settings) {
                if (!settings.glideraAccessToken) {
                    return false;
                }

                return accessToken().then(function(accessToken) {
                    if (!accessToken) {
                        return false;
                    }

                    var r = createRequest(null, accessToken);

                    return r.request('GET', '/authentication/get2faCode', {}, null)
                        .then(function(result) {
                            $log.debug('get2faCode', JSON.stringify(result, null, 4));

                            return result.mode;
                        })
                    ;
                });
            })
                .then(function(userCanTransact) { return userCanTransact; }, function(err) { $log.log(err); throw err; })
            ;
        };

        var decryptAccessToken = function(secretBuf) {
            return settingsService.getSettings().then(function(settings) {
                $log.debug('glideraAccessToken', JSON.stringify(settings.glideraAccessToken, null, 4));

                return settings.glideraAccessToken ? settings.glideraAccessToken.encryptedAccessToken : null;
            }).then(function(encryptedAccessToken) {
                if (!encryptedAccessToken) {
                    return;
                }

                var accessToken = blocktrailSDK.Encryption.decrypt(new blocktrailSDK.Buffer(encryptedAccessToken, 'base64'), secretBuf).toString('utf8');

                setDecryptedAccessToken(accessToken);

                return accessToken;
            });
        };

        var accessTokenPromise = null; // use promise to avoid doing things twice

        var accessToken = function() {
            return settingsService.getSettings().then(function(settings) {
                if (decryptedAccessToken) {
                    $log.debug('decryptedAccessToken');
                    return decryptedAccessToken;
                } else if (accessTokenPromise) {
                    $log.debug('accessTokenPromise');
                    return accessTokenPromise;
                }

                if (!settings.glideraAccessToken) {
                    return null;
                }

                var def = $q.defer();

                accessTokenPromise = def.promise;

                $timeout(function() {
                    var unlockWallet = function() {
                        return dialogService.prompt({
                            body: $translate.instant('MSG_BUYBTC_PASSWORD_TO_DECRYPT'),
                            title: $translate.instant('ENTER_CURRENT_PASSWORD'),
                            input_type: 'password',
                            icon: 'key'
                        })
                            .result
                            .then(function(password) {
                                return activeWallet.unlockWithPassword(password)
                                    .catch(function(e) {
                                        return unlockWallet();
                                    })
                            });
                    };

                    return unlockWallet()
                        .then(function(wallet) {
                            var walletSecretBuf = wallet.secret;
                            if (wallet.walletVersion === 'v2') {
                                walletSecretBuf = new blocktrailSDK.Buffer(walletSecretBuf, 'hex');
                            }

                            wallet.lock();

                            return decryptAccessToken(walletSecretBuf);
                        })
                        .then(function(r) {
                            $log.debug('DONE');
                            accessTokenPromise = null;
                            def.resolve(r);
                        }, function(err) {
                            $log.debug('DONE ERR');
                            accessTokenPromise = null;
                            $log.debug(err);
                            def.reject(err);
                        });
                }, 100);

                return accessTokenPromise;
            });
        };

        var buyPrices = function(qty, fiat) {
            return sdkService.sdk().then(function(sdk) {
                return sdk.glideraBuyPrices(qty, fiat)
                    .then(function(result) {
                        console.log('buyPrices ' + JSON.stringify(result));

                        return result;
                    });
            });
        };

        var buyPricesUuid = function(qty, fiat) {
            return accessToken().then(function(accessToken) {
                var r = createRequest(null, accessToken, null);
                return r.request('POST', '/prices/buy', {}, qty && {qty: qty} || {fiat: fiat})
                    .then(function(result) {
                        console.log('buyPricesUuid ' + JSON.stringify(result));

                        return result;
                    }, function(err) {
                        if (handleGlideraErr(err)) {
                            return $q.reject('dismiss');
                        } else {
                            throw err;
                        }
                    });
            });
        };

        var buy = function(qty, priceUuid) {
            return userCanTransact().then(function(userCanTransact) {
                if (!userCanTransact) {
                    throw new Error("User can't transact!");
                }

                return accessToken().then(function(accessToken) {

                    return activeWallet.getNewAddress().then(function(address) {

                        return twoFactor().then(function(twoFactor) {
                            var r = createRequest(null, accessToken, twoFactor);
                            return r.request('POST', '/buy', {}, {
                                destinationAddress: address,
                                qty: qty,
                                priceUuid: priceUuid,
                                useCurrentPrice: false
                            })
                                .then(function(result) {
                                    $log.debug('buy', JSON.stringify(result, null, 4));

                                    var glideraTransaction = {
                                        address: address,
                                        time: Math.floor((new Date()).getTime() / 1000),
                                        transactionUuid: result.transactionUuid,
                                        transactionHash: result.transactionHash || null,
                                        status: result.status,
                                        qty: result.qty,
                                        price: result.price,
                                        total: result.total,
                                        currency: result.currency,
                                        // add walletIdentifier so we always know which wallet it belongs to
                                        walletIdentifier: activeWallet._sdkWallet.identifier
                                    };

                                    return settingsService.addGlideraTransaction(glideraTransaction).then(function() {
                                        updatePendingTransactions();
                                        return result;
                                    });
                                })
                            ;
                        });
                    });
                });
            });
        };

        var setClientId = function(_clientId) {
            clientId = _clientId;
        };

        var pollPendingTransactions = true;

        var updatePendingTransactions = function() {
            var _update = function() {
                pollPendingTransactions = false;
                var delay = 10000;

                return $q.when(decryptedAccessToken).then(function(accessToken) {
                    if (accessToken) {
                        settingsService.getSettings()
                            .then(function (settings) {
                                var updateStatus = {};

                                $q.all(settings.glideraTransactions.map(function(transaction) {
                                    if (transaction.status === 'PROCESSING' || !transaction.transactionHash) {
                                        pollPendingTransactions = true;
                                        var r = createRequest(null, accessToken);
                                        return r.request('GET', '/transaction/' + transaction.transactionUuid, {})
                                            .then(function(result) {
                                                updateStatus[transaction.transactionUuid] = result;
                                            })
                                            ;
                                    } else {
                                        return $q.when(null);
                                    }
                                }))
                                .then(function() {
                                    var glideraTransactions = settings.glideraTransactions.map(function(transaction) {
                                        if (typeof updateStatus[transaction.transactionUuid] !== "undefined") {
                                            var newTxInfo = updateStatus[transaction.transactionUuid];
                                            var oldStatus = transaction.status;

                                            // sometimes a tx is marked COMPLETE but missing a transactionHash,
                                            //  in that case we force another update
                                            if (newTxInfo.status === 'COMPLETE' && !newTxInfo.transactionHash) {
                                                delay = 0;
                                            } else {
                                                transaction.qty = newTxInfo.qty;
                                                transaction.status = newTxInfo.status;
                                                transaction.transactionHash = newTxInfo.transactionHash;

                                                if (oldStatus === 'PROCESSING' && transaction.status === 'COMPLETE') {
                                                    $rootScope.$broadcast('glidera_complete', transaction);
                                                }
                                            }
                                        }

                                        return transaction;
                                    });

                                    return settingsService.updateGlideraTransactions(glideraTransactions);
                                });
                        });
                    }
                })
                    .then(function() {
                    }, function(e) {
                        $log.error('updatePendingTransactions ' + e);
                    })
                    .then(function() {
                        if (delay) {
                            if (pollPendingTransactions) {
                                $timeout(updatePendingTransactions, delay);
                            }
                        } else {
                            // do it again
                            return _update();
                        }
                    })
                ;
            };

            _update();
        };

        var updateAllTransactions = function(initLoop) {
            return accessToken().then(function(accessToken) {
                if (accessToken) {
                    var updateTxs = [];

                    var r = createRequest(null, accessToken);
                    return r.request('GET', '/transaction', {})
                        .then(function(results) {
                            results.transactions.forEach(function(result) {
                                updateTxs.push(result);
                            });
                        })
                        .then(function() {

                            return settingsService.getSettings()
                                .then(function (settings) {
                                    var oldTxMap = {};

                                    settings.glideraTransactions.forEach(function(tx) {
                                        oldTxMap[tx.transactionUuid] = tx;
                                    });


                                    var glideraTransactions = updateTxs.map(function(updateTx) {
                                        var tx = oldTxMap[updateTx.transactionUuid] || {};

                                        return {
                                            address: tx.address || null,
                                            time: tx.time || null,
                                            transactionUuid: updateTx.transactionUuid,
                                            transactionHash: updateTx.transactionHash || tx.transactionHash || null,
                                            qty: updateTx.qty,
                                            status: updateTx.status,
                                            price: updateTx.price,
                                            total: updateTx.total,
                                            currency: updateTx.currency,
                                            walletIdentifier: null
                                        };
                                    });

                                    return settingsService.updateGlideraTransactions(glideraTransactions)
                                });
                        })
                    ;
                } else {
                    return false;
                }
            })
                .then(function(r) { return r; }, function(e) { $log.error('updateAllTransactions ' + e); })
                .then(function(r) {
                    if (initLoop) {
                        if (r) {
                            $timeout(updatePendingTransactions, 10000);
                        } else {
                            $timeout(updateAllTransactions, 10000);
                        }
                    }
                })
            ;
        };

        // don't really init the service unless BUYBTC is enabled
        if (CONFIG.BUYBTC) {
            $q.when(launchService.getWalletSecret())
                .then(function(walletSecret) {
                    if (!walletSecret) {
                        return;
                    }
                    var walletSecretBuf = new blocktrailSDK.Buffer(walletSecret, 'hex');

                    return decryptAccessToken(walletSecretBuf);
                })
                .then(function() {
                    // return updateAllTransactions(); // @TODO: DEBUG
                    return updatePendingTransactions();
                }, function(e) {
                    $log.debug('initDecryptAccessToken2 ERR ' + e);
                });
        }

        return {
            setClientId: setClientId,
            createRequest: createRequest,
            oauth2: oauth2,
            setup: setup,
            decryptAccessToken: decryptAccessToken,
            twoFactor: twoFactor,
            handleOauthCallback: handleOauthCallback,
            accessToken: accessToken,
            userCanTransact: userCanTransact,
            buyPrices: buyPrices,
            buyPricesUuid: buyPricesUuid,
            buy: buy
        };
    }
);
