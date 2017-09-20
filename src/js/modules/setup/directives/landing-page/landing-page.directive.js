(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("landingPage", landingPage);

    function landingPage(CONFIG, $state) {
        return {
            restrict: "E",
            transclude: true,
            scope: {},
            templateUrl: "js/modules/setup/directives/landing-page/landing-page.tpl.html",
            link: function(scope) {
                scope.CONFIG = CONFIG;
                scope.$state = $state;
            }
        };
    }

})();
