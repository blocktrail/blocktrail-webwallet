(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("appWrapper", appWrapper);

    function appWrapper(CONFIG, $state) {
        return {
            restrict: "E",
            transclude: true,
            scope: {
                title: '='
            },
            templateUrl: "js/modules/core/directives/app-wrapper/app-wrapper.tpl.html",
            link: function(scope) {
                scope.CONFIG = CONFIG;
                scope.$state = $state;
            }
        };
    }

})();
