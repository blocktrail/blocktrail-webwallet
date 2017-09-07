(function () {
    "use strict";

    angular.module('blocktrail.core')
        .factory('networkService', function() {
            return new NetworkService();
        });

    function NetworkService() {
        var self = this;

        // Network data
        self._networkData = {
            type: ""
        };

        // Read only settings object
        // the object would be shared
        self._readonlyDoc = {
            readonly: true
        };

        angular.forEach(self._networkData, function(value, key) {
            Object.defineProperty(self._readonlyDoc, key, {
                set: function() {
                    throw new Error("Read only object. Blocktrail core module, network service.");
                },
                get: function() {
                    return self._networkData[key];
                }
            });
        });
    }

    NetworkService.prototype.getReadOnlyNetworkData = function() {
        var self = this;

        return self._readonlyDoc;
    };

    NetworkService.prototype.setNetworkType = function(networkType) {
        var self = this;

        self._networkData.type = networkType;

        return true;
    };
})();
