(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("appBccForkWarning", appBccForkWarning);

    function appBccForkWarning() {
        return {
            restrict: "E",
            replace: true,
            templateUrl: "js/modules/wallet/directives/app-bcc-fork-warning/app-bcc-fork-warning.tpl.html"
        };
    }

})();

