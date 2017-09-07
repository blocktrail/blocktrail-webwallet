(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("networkCustomSelect", networkCustomSelect);

    function networkCustomSelect(CONFIG) {
        return {
            restrict: "E",
            replace: true,
            scope: {
                form: '=',
                networkTypes: '='
            },
            templateUrl: "js/modules/core/directives/network-custom-select/network-custom-select.tpl.html",
            link: function(scope) {
                scope.CONFIG = CONFIG;

                // copy original network types for their order
                var originalNetworkTypes = scope.networkTypes.slice();

                function sortNetworkTypes() {
                    scope.networkTypes.sort(function(a, b) {
                        // always prioritize the selected value
                        if (a.value === scope.form.networkType) {
                            return -1;
                        } else if (b.value === scope.form.networkType) {
                            return 1;
                        }

                        // otherwise just sort
                        return (originalNetworkTypes.indexOf(a) < originalNetworkTypes.indexOf(b)) ? -1 : 1;
                    });
                }

                scope.$watch('form.networkType', function() {
                    sortNetworkTypes();
                })
            }
        };
    }

})();
