(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("clickAnywhereButHere", clickAnywhereButHere);

    function clickAnywhereButHere($document, $timeout) {
        return {
            link: function postLink(scope, element, attrs) {
                var onClick = function (event) {
                    var isChild = element[0].contains(event.target);
                    var isSelf = element[0] === event.target;
                    var isInside = isChild || isSelf;
                    if (!isInside) {
                        scope.$apply(attrs.clickAnywhereButHere);
                    }
                };

                scope.$watch(attrs.isActive, function(newValue, oldValue) {
                    if (newValue !== oldValue && newValue === true) {
                        $timeout(function() {
                            $document.bind("click", onClick);
                        });
                    }
                    else if (newValue !== oldValue && newValue === false) {
                        $timeout(function() {
                            $document.unbind("click", onClick);
                        });
                    }
                });
            }
        };
    }

})();
