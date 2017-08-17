(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appTwoFactorWarning", appTwoFactorWarning);

    function appTwoFactorWarning() {
        return {
            restrict: "E",
            replace: true,
            scope: {},
            templateUrl: "js/modules/wallet/directives/app-two-factor-warning/app-two-factor-warning.tpl.html"
        };
    }

})();
