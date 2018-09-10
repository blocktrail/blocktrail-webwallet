(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("socialMediaButtons", socialMediaButtons);

    function socialMediaButtons() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                language: '='
            },
            templateUrl: "js/modules/wallet/directives/social-media-buttons/social-media-buttons.tpl.html"
        };
    }

})();
