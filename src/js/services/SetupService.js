angular.module('blocktrail.wallet').factory(
    'setupService',
    function(storageService, $q) {
        var userInfoId = 'user-info';

        var SetupService = function() {
            var self = this;

            self.storage = storageService.db('setup');
        };

        /**
         * store user info so they can be added to settings after setup is done
         *
         */
        SetupService.prototype.setUserInfo = function(userInfo) {
            var self = this;

            return $q.when(self.storage.get(userInfoId))
                .then(function(doc) { return doc; }, function() { return {_id: userInfoId}; })
                .then(function(doc) {
                    angular.forEach(userInfo, function(value, key) {
                        doc[key] = userInfo[key];
                    });

                    return self.storage.put(doc).then(function() {
                        return true;
                    });
                });
        };

        SetupService.prototype.getUserInfo = function() {
            var self = this;

            return $q.when(self.storage.get(userInfoId))
                .then(function(doc) { return doc; }, function() { return {_id: userInfoId}; });
        };

        SetupService.prototype.clearUserInfo = function() {
            var self = this;

            return $q.when(self.storage.get(userInfoId))
                .then(function(doc) {
                    return self.storage.remove(doc);
                }, function() {
                    return true;
                });
        };

        return new SetupService();
    }
);
