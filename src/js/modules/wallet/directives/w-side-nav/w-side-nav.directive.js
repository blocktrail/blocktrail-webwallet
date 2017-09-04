(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wSideNav", wSideNav);

    function wSideNav() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                list: '='
            },
            templateUrl: "js/modules/wallet/directives/w-side-nav/w-side-nav.tpl.html"
        };
    }

})();
