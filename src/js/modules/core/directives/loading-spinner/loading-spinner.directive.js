(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("loadingSpinner", loadingSpinner);

    function loadingSpinner() {
        return {
            restrict: "EA",
            transclude: false,
            scope: {
                loadingSpinnerSize: "@"
            },
            template: '<div class="loading-spinner loading-spinner-{{ loadingSpinnerSize }}">' +
            '<div class="loading loading-0"></div>' +
            '<div class="loading loading-1"></div>' +
            '<div class="loading loading-2"></div>' +
            '</div>'
        };
    }

})();
