(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("navbar", navbar);

    function navbar(CONFIG, $state) {
        return {
            restrict: "E",
            replace: true,
            scope: {
                mode: '='
            },
            templateUrl: "js/modules/core/directives/navbar/navbar.tpl.html",
            link: function(scope) {
                scope.CONFIG = CONFIG;
                scope.$state = $state;
            }
        };
    }

})();
