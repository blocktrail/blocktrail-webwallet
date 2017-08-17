(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wAppStoreButtons", wAppStoreButtons);

    function wAppStoreButtons() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                data: '='
            },
            templateUrl: "js/modules/wallet/directives/w-app-store-buttons/w-app-store-buttons.tpl.html"
        };
    }

})();
