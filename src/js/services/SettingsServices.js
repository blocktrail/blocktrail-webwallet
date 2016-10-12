angular.module('blocktrail.wallet').service('settingsService', function($q, storageService, sdkService, $log) {
    var defaults = {
        displayName:  null,
        username:  '',
        email:  null,
        language: 'en',
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
        setupComplete: false,

        glideraRequest: null,
        glideraAccessToken: null,

        buyBTCRegion: null
    };
    angular.extend(this, defaults);

    var storage = storageService.db('settings');

    this._id = "user_settings";

    this._$isLoaded = null;
    /**
     * returns a promise to get the data, does not force update
     * @returns {null|*}
     */
    this.$isLoaded = function() {
        if (!this._$isLoaded) {
            this._$isLoaded = this.$load();
        }

        return this._$isLoaded;
    };

    /**
     * load the data from the database
     * @returns {*}
     */
    this.$load = function() {
        var self = this;

        return $q.when(storage.get('user_settings')
            .then(
                function(doc) { return angular.extend(self, doc); },
                function() { return angular.extend(self, defaults); }
            )
        );
    };

    /**
     * update database copy of the data
     * @returns {*}     promise
     */
    this.$store = function() {
        var self = this;

        return $q.when(storage.get('user_settings')
                .then(function(doc) { return doc; }, function() { return {_id: "user_settings"}; })
                .then(function(doc) {
                    //update each of the values as defined in the defaults array
                    angular.forEach(defaults, function(value, key) {
                        doc[key] = self[key];
                    });

                    return storage.put(doc).then(function() {
                        return doc;
                    });
                })
        );
    };

    this.$syncSettingsUp = function() {
        var self = this;

        return $q.when(sdkService.sdk())
            .then(function(sdk) {
                var settingsData = {
                    localCurrency: self.localCurrency,
                    language: self.language,
                    receiveNewsletter: self.receiveNewsletter,
                    username: self.username,
                    email: self.email
                };

                return sdk.syncSettings(settingsData);
            })
        ;
    };

    /**
     * update server copy of profile data, and store in settings the success/failure of syncing
     * @returns {*}     promise
     */
    this.$syncProfileUp = function() {
        var self = this;
        return $q.when(sdkService.sdk())
            .then(function(sdk) {
                var profileData = {
                    profilePic: self.profilePic
                };
                return sdk.syncProfile(profileData).then(function(result) {
                    //profile synced successfully
                    return $q.when(self.profileSynced = true);
                }, function(err) {
                    //profile not synced
                    return $q.when(self.profileSynced = false);
                });
            })
            .then(function(result) {
                return storage.get('user_settings').then(function(doc) {
                    doc.profileSynced = self.profileSynced;
                    $log.debug('syncing profile');
                    return storage.put(doc).then(function() {
                        $log.debug('profile synced');
                        return doc;
                    });
                });
            });
    };

    /**
     * update local copy of profile data from server
     * @returns {*}     promise
     */
    this.$syncProfileDown = function() {
        var self = this;
        return $q.when(sdkService.sdk())
            .then(function(sdk) {
                return sdk.getProfile();
            })
            .then(function(result) {
                return storage.get('user_settings').then(function(doc) {
                    //store profile data
                    doc.profilePic = result.profilePic && ("data:image/jpeg;base64, " + result.profilePic) || null;
                    return $q.when(storage.put(doc)).then(function() {
                        //update service attrs
                        self.profilePic = doc.profilePic;
                        return doc;
                    });
                });
            });
    };

    this.$syncSettingsDown = function() {
        var self = this;
        return $q.when(sdkService.sdk())
            .then(function(sdk) {
                return sdk.getSettings();
            })
            .then(function(result) {
                return self.$isLoaded().then(function() {
                    self.receiveNewsletter = result.receiveNewsletter !== null ? result.receiveNewsletter : self.receiveNewsletter;
                    self.language = result.language !== null ? result.language : self.language;
                    self.localCurrency = result.localCurrency !== null ? result.localCurrency : self.localCurrency;
                    self.username = result.username;
                    self.email = result.email;

                    return self.$store();
                });
            });
    };

});
