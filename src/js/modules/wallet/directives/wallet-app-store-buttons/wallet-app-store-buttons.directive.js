(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("walletAppStoreButtons", walletAppStoreButtons);

    function walletAppStoreButtons() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                language: '='
            },
            templateUrl: "js/modules/wallet/directives/wallet-app-store-buttons/wallet-app-store-buttons.tpl.html"
        };
    }

})();
