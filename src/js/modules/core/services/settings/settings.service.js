(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('settingsService', function($q, storageService, sdkService) {
            return new Settings($q, sdkService, storageService);
        });

    function Settings($q, sdkService, storageService) {
        var self = this;
        // Document id
        var documentId = "user_settings";
        // Settings
        var settings = {
            _id: documentId,
            displayName:  null,
            username:  '',
            email:  null,

            passwordScore: null,
            verifiedEmail: null,
            pendingEmailVerification: null,

            // [UP] language stores the currently selected language
            language: null,
            // [LOCAL] extraLanguages is the list of languages we can enable, cached locally
            extraLanguages: [],
            // [UP] knownLanguages is the list of languages we know are available (used to prompt user when we have new languages)
            knownLanguages: [],
            timezone:  "GMT+1",
            localCurrency:  "EUR",
            profilePic:  null,
            profileSynced: true,
            receiveNewsletter: 1,
            profilePosX:  50,
            profilePosY:  50,
            twoFactorWarningLastDisplayed: null,
            contactsLastSync: null,
            useTestnet: false,      // dev setting - enables testnet for SDK
            walletActivated: false,

            showArchived: false,

            glideraRequest: null,
            glideraAccessToken: null,
            glideraTransactions: [],

            latestVersionWeb: null,
            glideraActivationNoticePending: null,
            hideBCCSweepWarning: false,

            simplexLastForward: null,
            simplexLastForwardDelta: 30, // 30 seconds

            registerURIHandlerExecuted: false,
            registerURIHandlerNotifyCounter: 0,
            registerURIHandlerNotifyCounterMax : 3,
            registerURIHandlerNotifyTimestamp : null,
            registerURIHandlerNotifyTimestampDelta : 86400 * 7, // One week in seconds
        };

        // Mapping for object dependencies
        self._$q = $q;
        self._sdkService = sdkService;

        // Id of the document we keep in storage
        self._id = documentId;

        // Syncing down flags are promises when we're syncing down
        self._syncingSettingsDown = null;
        self._syncingProfileDown = null;

        // We only load from local storage once, after that this is set to TRUE
        self._loaded = false;

        self.$_updateLocalStorage = null;

        // Init storage DB
        self._storage = storageService.db('settings');

        // Settings object with pending functionality, only for internal usage!
        self._doc = {
            _id: documentId
        };

        // Pending object will hold settings changed while we syncing
        self._pending = {};

        // Pending property list for settings
        self._pendingSettingsPropertyList = [
            "verifiedEmail",
            "passwordScore",
            "localCurrency",
            "language",
            "receiveNewsletter",
            "glideraAccessToken",
            "glideraTransactions",
            "latestVersionWeb",
            "glideraActivationNoticePending",
            "username",
            "email",
            "hideBCCSweepWarning",
            "walletActivated",
            "knownLanguages",
            "showArchived"
        ];

        // Pending property list for portfolio
        self._pendingProfilePropertyList = [
            "profilePic"
        ];

        angular.forEach(settings, function(value, key) {
            Object.defineProperty(self._doc, key, {
                set: function(value) {
                    // Check on syncing settings down
                    if (self._syncingSettingsDown && self._pendingSettingsPropertyList.indexOf(key) !== -1) {
                        self._pending[key] = value;

                    }
                    // Check on syncing profile down
                    else if(self._syncingProfileDown && self._pendingProfilePropertyList.indexOf(key) !== -1) {
                        self._pending[key] = value;
                    }
                    // Update the settings object
                    else {
                        settings[key] = value;
                    }
                },
                get: function() {
                    return settings[key];
                },
                // https://github.com/angular/angular.js/issues/8573
                // Fixes getter and setter properties not copied by deep object copy
                enumerable: true
            });
        });

        // Read only settings object
        // the object would be shared
        self._readonlyDoc = {
            readonly: true
        };

        angular.forEach(settings, function(value, key) {
            Object.defineProperty(self._readonlyDoc, key, {
                set: function() {
                    throw new Error("Read only object. Blocktrail core module, settings service.");
                },
                get: function() {
                    return settings[key];
                }
            });
        });
    }

    /**
     * Get setting check on loaded data and synchronization with a local storage,
     * as resolve parameter we get _readonlyDoc object
     * @returns { promise }
     */
    Settings.prototype.getSettings = function() {
        var self = this;
        var promise;

        if (self._loaded === false) {
            promise = self._loadSettings();
        } else if (self._loaded === true) {
            promise = self._$q.when(true).then(self._getSettings.bind(self));
        } else {
            promise = self._loaded;
        }

        return promise;
    };

    /**
     * Update settings
     * @param newSettings
     * @returns { promise }
     */
    Settings.prototype.updateSettingsUp = function(newSettings) {
        var self = this;
        var promise;

        // wait for syncing down to be done before syncing up
        if (self._syncingSettingsDown) {
            self._syncingSettingsDown.then(function() {
                promise = self.updateSettingsUp(newSettings);
            })
        } else {
            var settingsUpFlag = self.checkOnPropertyUpList(newSettings, self._pendingSettingsPropertyList);
            var profileUpFlag = self.checkOnPropertyUpList(newSettings, self._pendingProfilePropertyList);

            angular.extend(self._doc, newSettings);

            // Update local storage
            promise = self._updateLocalStorage();

            if(settingsUpFlag && profileUpFlag) {
                var promiseForSettingsAndProfile = self._$q.all([self._syncSettingsUp(), self._syncProfileUp()]);

                promise = promise.then(promiseForSettingsAndProfile);
            } else if(settingsUpFlag) {
                promise = promise.then(self._syncSettingsUp.bind(this));
            } else if(profileUpFlag) {
                promise = promise.then(self._syncProfileUp.bind(this));
            }

            promise = promise.then(function() {
                return self._readonlyDoc;
            });
        }

        return promise;
    };

    /**
     * Check on properties that in a pending list
     * @param obj
     * @param propertyList
     * @returns { boolean }
     */
    Settings.prototype.checkOnPropertyUpList = function(obj, propertyList) {
        var flag = false;
        var i = 0;

        while(i < propertyList.length && !flag) {
            if(angular.isDefined(obj[propertyList[i]])) {
                flag = true;
            }

            i++;
        }

        return flag;
    };

    /**
     * Add glidera transactions
     * @param transaction
     * @returns { promise }
     */
    Settings.prototype.addGlideraTransaction = function(transaction) {
        var self = this;
        var promise;

        // wait for syncing down to be done before syncing up
        if (self._syncingSettingsDown) {
            self._syncingSettingsDown.then(function() {
                promise = self.addGlideraTransaction(transaction);
            })
        } else {
            self._doc.glideraTransactions.push(transaction);

            promise = self._updateLocalStorage()
                .then(self._syncSettingsUp.bind(this))
                .then(function() {
                    return self._readonlyDoc;
                });
        }

        return promise;
    };

    /**
     * Update glidera transaction
     * @param transactions
     * @returns { promise }
     */
    Settings.prototype.updateGlideraTransactions = function(transactions) {
        var self = this;
        var promise;

        // wait for syncing down to be done before syncing up
        if (self._syncingSettingsDown) {
            self._syncingSettingsDown.then(function() {
                promise = self.updateGlideraTransactions(transactions);
            })
        } else {
            self._doc.glideraTransactions = transactions;

            promise = self._updateLocalStorage()
                .then(self._syncSettingsUp.bind(this))
                .then(function() {
                    return self._readonlyDoc;
                });
        }

        return promise;
    };

    /**
     * Get settings object return a link on _readonlyDoc
     * @returns _readonlyDoc { promise }
     */
    Settings.prototype.getReadOnlySettingsData = function() {
        var self = this;

        return self._readonlyDoc;
    };

    /**
     * Synchronize settings data with remote server and update properties that were changed during synchronization
     * @returns _syncingSettingsDown { promise }
     * @private
     */
    Settings.prototype.syncSettingsDown = function() {
        var self = this;

        if (!this._syncingSettingsDown) {
            this._syncingSettingsDown = self._$q.when(self._syncSettingsDown())
                .then(self._syncSettingsFromPendingObject.bind(self))
                .then(self._updateLocalStorage.bind(self))
                .finally(function() {
                    return self._readonlyDoc;
                });
        }

        return this._syncingSettingsDown;
    };

    /**
     * Synchronize profile data with remote server and update properties that were changed during synchronization
     * @returns _syncingProfileDown { promise }
     * @private
     */
    Settings.prototype.syncProfileDown = function() {
        var self = this;

        if (!self._syncingProfileDown) {
            self._syncingProfileDown = self._$q.when(self._syncProfileDown())
                .then(this._syncSettingsFromPendingObject.bind(self))
                .then(self._updateLocalStorage.bind(self))
                .finally(function() {
                    return self._readonlyDoc;
                });
        }

        return this._syncingProfileDown;
    };

    /**
     * Load settings and profile data and synchronize with local storage
     * WARNING: should be called ones
     * @returns { promise }
     * @private
     */
    Settings.prototype._loadSettings = function() {
        var self = this;

        self._loaded = self._$q
            // Synchronize data with local storage
            .when(self._syncDocWithLocalStorage())
            // Synchronize settings and profile data with remote server
            .then(self._syncSettingsAndProfileDown.bind(self))
            // Return read only settings object
            .then(self._getSettings.bind(self))
            // Change loaded flag
            .finally(function() {
                self._loaded = true;
            });

        return self._loaded;
    };

    /**
     * Fetch data from the local storage and update the _doc
     * @returns _doc { promise }
     * @private
     */
    Settings.prototype._syncDocWithLocalStorage = function() {
        var self = this;

        return self._$q.when(self._storage.get(self._id))
            .then(function(doc) {
                angular.extend(self._doc, doc);
                return self._doc;
            },
            // error is acceptable here cuz it will happen when the document doesn't exist yet
            function() {
                return self._doc;
            });
    };

    /**
     * Synchronize settings and profile data with remote server
     * @returns { promise } all[ _syncingSettingsDown, _syncingProfileDown ]
     * @private
     */
    Settings.prototype._syncSettingsAndProfileDown = function() {
        var self = this;

        return self._$q.all([self.syncSettingsDown(), self.syncProfileDown()]);
    };

    /**
     * Synchronize settings data with remote server
     * @returns { promise }
     * @private
     */
    Settings.prototype._syncSettingsDown = function() {
        var self = this;

        return self._$q.when(self._sdkService.getSdkByActiveNetwork())
            .then(self._getSDKSettings.bind(self))
            .then(self._setSDKSettingsToDoc.bind(self));
    };

    /**
     * Fetch settings data from remote server
     * @param sdk
     * @returns sdkSettings { Object }
     * @private
     */
    Settings.prototype._getSDKSettings = function(sdk) {
        return sdk.getSettings();
    };

    /**
     * Set settings data form server to _doc
     * @param sdkSettings
     * @returns _doc { Object }
     * @private
     */
    Settings.prototype._setSDKSettingsToDoc = function(sdkSettings) {
        var self = this;
        // Reset flag before set
        self._syncingSettingsDown = null;

        self._doc.receiveNewsletter = sdkSettings.receiveNewsletter !== null ? sdkSettings.receiveNewsletter : self._doc.receiveNewsletter;
        self._doc.language = sdkSettings.language !== null ? sdkSettings.language : self._doc.language;
        self._doc.localCurrency = sdkSettings.localCurrency !== null ? sdkSettings.localCurrency : self._doc.localCurrency;
        self._doc.glideraAccessToken = sdkSettings.glideraAccessToken;
        self._doc.glideraTransactions = sdkSettings.glideraTransactions || [];
        self._doc.username = sdkSettings.username;
        self._doc.email = sdkSettings.email;
        self._doc.latestVersionWeb = sdkSettings.latestVersionWeb;
        self._doc.glideraActivationNoticePending = sdkSettings.glideraActivationNoticePending;
        self._doc.hideBCCSweepWarning = sdkSettings.hideBCCSweepWarning;
        self._doc.walletActivated = sdkSettings.walletActivated;
        self._doc.knownLanguages = sdkSettings.knownLanguages;
        self._doc.passwordScore = sdkSettings.passwordScore;
        self._doc.verifiedEmail = sdkSettings.verifiedEmail;
        self._doc.showArchived = sdkSettings.showArchived;

        return self._doc;
    };

    /**
     * Synchronize profile data with remote server
     * @returns { promise }
     * @private
     */
    Settings.prototype._syncProfileDown = function() {
        var self = this;

        return this._$q.when(this._sdkService.getSdkByActiveNetwork())
            .then(this._getSDKProfile.bind(self))
            .then(this._setSDKProfileToDoc.bind(self));
    };

    /**
     * Fetch profile data from remote server
     * @param sdk
     * @returns sdkProfile { Object }
     * @private
     */
    Settings.prototype._getSDKProfile = function(sdk) {
        return sdk.getProfile();
    };

    /**
     * Set profile data form server to _doc
     * @param sdkProfile
     * @returns _doc { Object }
     * @private
     */
    Settings.prototype._setSDKProfileToDoc = function(sdkProfile) {
        var self = this;

        self._syncingProfileDown = null;

        self._doc.profilePic = sdkProfile.profilePic && ("data:image/jpeg;base64," + sdkProfile.profilePic) || null;

        return self._doc
    };

    /**
     * Get settings return read only object
     * @returns _readonlyDoc { object }
     * @private
     */
    Settings.prototype._getSettings = function() {
        var self = this;

        return self._readonlyDoc;
    };

    /**
     * Synchronize _doc with pending properties
     * @returns _doc
     * @private
     */
    Settings.prototype._syncSettingsFromPendingObject = function() {
        var self = this;

        // Copy the pending changes into the doc
        if (Object.keys(self._pending).length) {
            angular.forEach(self._pending, function(value, key) {
                // Synchronize _doc with settings pending properties
                if (!self._syncingSettingsDown && self._pendingSettingsPropertyList.indexOf(key) !== -1) {
                    self._doc[key] = self._pending[key];
                    delete self._pending[key];
                }

                // Synchronize _doc with profile pending properties
                if(!self._syncingProfileDown && self._pendingProfilePropertyList.indexOf(key) !== -1) {
                    self._doc[key] = self._pending[key];
                    delete self._pending[key];
                }
            });
        }

        return self._doc;
    };

    /**
     * Update local storage, copy of the _doc
     * @returns _doc { promise }
     * @private
     */
    Settings.prototype._updateLocalStorage = function() {
        var self = this;

        if (self.$_updateLocalStorage) {
            return self.$_updateLocalStorage.then(function() {
                return self._updateLocalStorage();
            });
        } else {
            self.$_updateLocalStorage = self._$q.when(this._storage.get(self._id)
                .catch(function() {
                }) // suppress document not exists error
                .then(function(doc) {
                    // Manually update rev id of document
                    if(doc && doc._rev !== self._doc._rev) {
                        self._doc._rev = doc._rev;
                    }

                    return self._storage.put(angular.copy(self._doc))
                        .catch(function(e) {
                            // Supress error, worst case it wasn't stored locally...
                        })
                        .then(function() {
                            self.$_updateLocalStorage = null;
                            return self._doc;
                        });
                })
            );
        }

        return self.$_updateLocalStorage;
    };

    /**
     * Sync settings up
     * @returns { promise }
     * @private
     */
    Settings.prototype._syncSettingsUp = function() {
        var self = this;

        return this._$q.when(self._sdkService.getSdkByActiveNetwork())
            .then(function(sdk) {
                var settingsData = {
                    localCurrency: self._doc.localCurrency,
                    language: self._doc.language,
                    receiveNewsletter: self._doc.receiveNewsletter,
                    glideraAccessToken: self._doc.glideraAccessToken,
                    glideraTransactions: self._doc.glideraTransactions || [],
                    latestVersionWeb: self._doc.latestVersionWeb,
                    glideraActivationNoticePending: self._doc.glideraActivationNoticePending,
                    passwordScore: self._doc.passwordScore,
                    buyBTCRegion: self._doc.buyBTCRegion,
                    username: self._doc.username,
                    email: self._doc.email,
                    hideBCCSweepWarning: self._doc.hideBCCSweepWarning,
                    walletActivated: self._doc.walletActivated,
                    knownLanguages: self._doc.knownLanguages,
                    showArchived: self._doc.showArchived
                };

                return sdk.syncSettings(settingsData);
            });
    };

    /**
     * Sync profile up
     * @returns { promise }
     * @private
     */
    Settings.prototype._syncProfileUp = function() {
        var self = this;

        return this._$q.when(self._sdkService.getSdkByActiveNetwork())
            .then(function(sdk) {
                var profileData = {
                    profilePic: self._doc.profilePic
                };

                return sdk.syncProfile(profileData);
            });
    };

})();
