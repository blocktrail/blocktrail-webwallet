(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appBccSweepWarning", appBccSweepWarning);

    function appBccSweepWarning() {
        return {
            restrict: "E",
            replace: true,
            templateUrl: "js/modules/wallet/directives/app-bcc-sweep-warning/app-bcc-sweep-warning.tpl.html"
        };
    }

})();

