(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appHeader", appHeader);

    function appHeader() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                pageTitle: '=',
                balance: '=',
                uncBalance: '=',
                bitcoinPrices: '=',
                settings: '='
            },
            templateUrl: "js/modules/wallet/directives/app-header/app-header.tpl.html"
        };
    }

})();
