angular.module('blocktrail.wallet').factory(
    'Contacts',
    function($log, $rootScope, cryptoJS, settingsService, launchService, sdkService, storageService) {
        var Contacts = function() {
            var self = this;

            self.contactsCache = storageService.db('contacts');

            self._list = null;
        };

        /**
         * get the list of contacts, with their avatars and presence of a Wallet
         * @param forceFetch
         * @returns {*}
         */
        Contacts.prototype.list = function(forceFetch) {
            var self = this;

            if (!self._list || forceFetch) {
                self._list = self._sync();
            }

            return self._list;
        };

        /**
         * builds the list of contacts with Wallet matches and avatars assigned to each
         * @returns {*}     promise, resolves to object with list of contacts and list of contacts by their hashes
         */
        Contacts.prototype._sync = function(forceAll) {
            var self = this;

            return self.contactsCache.get('synced')
                .then(function(syncedDoc) {
                    $log.debug('Contacts.sync: previous sync');
                    return syncedDoc;
                }, function() {
                    $log.debug('Contacts.sync: no previous sync');
                    return {_id: "synced", lastSynced: 0, contacts: []};
                })
                .then(function(syncedDoc) {
                    var lastSynced = syncedDoc.lastSynced;
                    syncedDoc.lastSynced = Math.floor((new Date).getTime() / 1000);

                    return launchService.getAccountInfo().then(function(accountInfo) {
                        return sdkService.getSdkByActiveNetwork().contacts(!forceAll ? lastSynced : null)
                            .then(function(result) {
                                var contactsByHash = {};

                                syncedDoc.contacts.forEach(function(contact) {
                                    contactsByHash[contact.hash] = contact;
                                });

                                result.forEach(function(contactData) {
                                    var displayName = null;

                                    if (contactData.encrypted_display_name && accountInfo.secret) {
                                        try {
                                            displayName = cryptoJS.AES.decrypt(contactData.encrypted_display_name, accountInfo.secret).toString(cryptoJS.enc.Utf8);
                                            if (!displayName) {
                                                throw new Error("Failed to decrypt encrypted_display_name");
                                            }
                                        } catch (e) {
                                            $log.error(e);
                                        }
                                    }

                                    if (contactsByHash[contactData.hash]) {
                                        contactsByHash[contactData.hash].displayName = displayName;
                                        contactsByHash[contactData.hash].category = contactData.category;
                                        contactsByHash[contactData.hash].avatarUrl = contactData.avatar_url;
                                    } else {
                                        var contact = {
                                            hash: contactData.hash,
                                            displayName: displayName,
                                            category: contactData.category,
                                            avatarUrl: contactData.avatar_url
                                        };

                                        syncedDoc.contacts.push(contact);
                                        contactsByHash[contact.hash] = contact;
                                    }
                                });

                                return self.contactsCache.put(syncedDoc).then(function() {
                                    $log.debug('Contacts.sync: synced [' + result.length + ']');
                                    return {contacts: syncedDoc.contacts, contactsByHash: contactsByHash};
                                });
                            });
                    });
                })
            ;
        };

        /**
         * find a contact by a phone hash
         * @param hash
         * @returns {*}
         */
        Contacts.prototype.findByHash = function(hash) {
            var self = this;

            return self.list().then(function(list) {
                return list.contactsByHash[hash];
            });
        };

        /**
         * get a bitcoin address to send to for a contact
         * @param contact
         * @param hashIndex
         * @returns {*}
         */
        Contacts.prototype.getSendingAddress = function(contact, hashIndex) {
            var self = this;
            hashIndex = hashIndex ? hashIndex: 0;

            return sdkService.getSdkByActiveNetwork().then(function(sdk) {
                return sdk.requestContactAddress(contact.hashes[hashIndex]).then(function(result) {
                    return result;
                }, function(err) {
                    //if more than one phone hash try them all
                    if (contact.hashes.length > hashIndex+1) {
                        hashIndex++;
                        return self.getSendingAddress(contact, hashIndex);
                    } else {
                        $log.error(err);
                        throw err;
                    }
                });
            });
        };

        return new Contacts();
    }
);
