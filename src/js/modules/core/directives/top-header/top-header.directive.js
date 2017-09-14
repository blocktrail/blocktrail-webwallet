(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("topHeader", topHeader);

    function topHeader(CONFIG, $state) {
        return {
            restrict: "E",
            replace: true,
            scope: {
                mode: '='
            },
            templateUrl: "js/modules/core/directives/top-header/top-header.tpl.html",
            link: function(scope) {
                scope.CONFIG = CONFIG;
                scope.$state = $state;
            }
        };
    }

})();
