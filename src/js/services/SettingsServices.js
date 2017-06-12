angular.module('blocktrail.wallet').service('settingsService', function($q, storageService, sdkService, $log) {
    var self = this;

    // default settings
    //  Object.keys(defaults) is also used to know all settings that are supposed to exist
    //  so all settings must have a default
    var defaults = {
        displayName:  null,
        username:  '',
        email:  null,
        language: null,
        extraLanguages: [],
        timezone:  "GMT+1",
        localCurrency:  "EUR",
        profilePic:  null, //"data:image/png;base64,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",          //Blocktrail MyWallet logo as default
        profileSynced: true,
        receiveNewsletter: 1,
        profilePosX:  50,
        profilePosY:  50,
        twoFactorWarningLastDisplayed: null,
        contactsLastSync: null,
        enablePolling: true,    //dev setting - disables auto polling for transactions
        useTestnet: false,      //dev setting - enables testnet for SDK

        glideraRequest: null,
        glideraAccessToken: null,
        glideraTransactions: [],

        bitonicRequest: null,
        bitonicAccessToken: null,
        bitonicTransactions: [],

        latestVersionWeb: null,
        glideraActivationNoticePending: null,

        buyBTCRegion: null
    };
    // doc will hold the settings
    var doc = {};

    // syncingDown is a promise when we're syncing down
    // pending will hold settings changed while we syncing
    var syncingDown = null;
    var pending = {};

    // we only load from localstorage once, after that this is set to TRUE
    var loaded = false;

    angular.forEach(defaults, function(value, key) {
        Object.defineProperty(self, key, {
            set: function(v) {
                doc[key] = v;

                // if we're syncing down we store the property as pending
                //  so the syncing down doesn't overwrite this
                if (syncingDown) {
                    pending[key] = v;
                }
            },
            get: function() {
               return doc[key];
            }
        });
    });

    // init storage DB
    var storage = storageService.db('settings');
    // id of the document we keep in storage
    var _id = "user_settings";

    /**
     * @deprecated
     * used to wait for stuff to be loaded, now we just assume loading was done by some external force
     *
     * @returns {null|*}
     */
    self.$isLoaded = function() {
        return $q.when(true);
    };

    /**
     * @deprecated
     * used to store stuff to local storage, now this is done as part of $syncSettingsUp and $syncProfileUp
     *
     * @returns {null|*}
     */
    self.$store = function() {
        return $q.when(true);
    };

    /**
     * initial load,
     * shouldn't be called more than once
     * we assume some external force will ensure calling this at the right moment
     *
     * @returns {*}
     */
    self.$load = function() {
        if (loaded) {
            console.error("shouldn't $load more than once");
            return $q.when(true);
        }

        loaded = true;

        return $q.when(storage.get(_id)
            .then(
                function(_doc) { return angular.extend(doc, _doc); },
                // error is acceptable here cuz it will happen when the document doesn't exist yet
                function() { return angular.extend(doc, defaults); }
            )
        )
            .then(function() {
                return self.$syncSettingsDown();
            })
            .then(function() {
                return self.$syncProfileDown();
            })
            .then(function() {
                // update localstorage with the stuff we synced down
                return self.$updateLocalStorage();
            });
    };

    /**
     * update local copy of the data
     * @returns {*}     promise
     */
    self.$updateLocalStorage = function() {
        return $q.when(storage.get(_id)
            .then(
                function(doc) { return doc; },
                // when the document doesn't exist yet we will get an error
                // in that case we just pretend an empty document with the correct _id exists
                function() { return {_id: _id}; }
                )
            .then(function(doc) {
                // update each of the values as defined in the defaults array
                angular.forEach(defaults, function(value, key) {
                    doc[key] = self[key];
                });

                return storage.put(doc).then(function() {
                    return doc;
                }, function(e) { /* supress error, worst case it wasn't stored locally... */ });
            })
        );
    };

    self.$syncSettingsUp = function() {
        // wait for syncing down to be done before syncing up
        if (syncingDown) {
            syncingDown.then(function() {
                return self.$syncSettingsUp();
            })
        }

        return self.$updateLocalStorage().then(function() {
            return $q.when(sdkService.sdk())
                .then(function(sdk) {
                    var settingsData = {
                        localCurrency: doc.localCurrency,
                        language: doc.language,
                        receiveNewsletter: doc.receiveNewsletter,
                        glideraAccessToken: doc.glideraAccessToken,
                        glideraTransactions: doc.glideraTransactions || [],
                        latestVersionWeb: doc.latestVersionWeb,
                        glideraActivationNoticePending: doc.glideraActivationNoticePending,
                        buyBTCRegion: doc.buyBTCRegion,
                        username: doc.username,
                        email: doc.email
                    };

                    return sdk.syncSettings(settingsData);
                });
        });
    };

    self.$syncSettingsDown = function() {
        var _syncingDown = $q.when(sdkService.sdk())
            .then(function(sdk) {
                return sdk.getSettings();
            })
            .then(function(result) {
                doc.receiveNewsletter = result.receiveNewsletter !== null ? result.receiveNewsletter : doc.receiveNewsletter;
                doc.language = result.language !== null ? result.language : doc.language;
                doc.localCurrency = result.localCurrency !== null ? result.localCurrency : doc.localCurrency;
                doc.glideraAccessToken = result.glideraAccessToken;
                doc.glideraTransactions = result.glideraTransactions || [];
                doc.username = result.username;
                doc.email = result.email;
                doc.buyBTCRegion = result.buyBTCRegion;
                doc.latestVersionWeb = result.latestVersionWeb;
                doc.glideraActivationNoticePending = result.glideraActivationNoticePending;
            })
            .finally(function() {
                // only NULL the promise var if this is the promise stored in it
                // when it was triggered again the promise wouldn't be the same anymore
                if (syncingDown === _syncingDown) {
                    syncingDown = null;
                }

                // copy the pending changes into the doc
                if (Object.keys(pending).length) {
                    angular.forEach(pending, function(value, key) {
                        doc[key] = pending[key];
                    });
                    pending = {};
                }
            });

        // set global promise object for syncing
        syncingDown = _syncingDown;

        return syncingDown;
    };

    /**
     * update server copy of profile data, and store in settings the success/failure of syncing
     * @returns {*}     promise
     */
    self.$syncProfileUp = function() {
        return self.$updateLocalStorage().then(function() {
            return $q.when(sdkService.sdk())
                .then(function(sdk) {
                    var profileData = {
                        profilePic: self.profilePic
                    };
                    return sdk.syncProfile(profileData);
                });
        });
    };

    /**
     * update local copy of profile data from server
     * @returns {*}     promise
     */
    self.$syncProfileDown = function() {
        return $q.when(sdkService.sdk())
            .then(function(sdk) {
                return sdk.getProfile();
            })
            .then(function(result) {
                //store profile data
                doc.profilePic = result.profilePic && ("data:image/jpeg;base64, " + result.profilePic) || null;

                return self.$updateLocalStorage();
            });
    };
});
