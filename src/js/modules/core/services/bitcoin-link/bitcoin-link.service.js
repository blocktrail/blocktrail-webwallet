(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('bitcoinLinkService', bitcoinLinkService);

    function bitcoinLinkService() {

        // borrowed from bip21, with a modification for optional addresses
        // in urls.
        function decodeBitcoin (uri) {
            var qregex = /(bitcoin|bitcoincash):\/?\/?([^?]+)?(\?([^]+))?/.exec(uri);
            if (!qregex) throw new Error('Invalid BIP21 URI: ' + uri);

            var protocol = qregex[1];
            var address = qregex[2];
            var query = qregex[4];

            var options = parseQuery("?"+query);
            if (options.amount) {
                options.amount = Number(options.amount);
                if (!isFinite(options.amount)) throw new Error('INnvalid amount');
                if (options.amount < 0) throw new Error('Invalid amount');
            }

            return { address: address, options: options, protocol: protocol};
        }

        return {
            decodeBitcoin: decodeBitcoin
        };
    }
})();
