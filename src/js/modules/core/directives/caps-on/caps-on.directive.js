(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("capsOn", capsOn);

    function capsOn() {
        return {
            link: function(scope, element, attrs) {
                if (attrs.capsOnBlurNull) {
                    element.on("blur", function() {
                        scope[attrs.capsOn] = null;
                    });
                }

                element.on("keypress", function(e) {
                    // An empty field resets the visibility.
                    if (!element.val()) {
                        return;
                    }

                    var character = String.fromCharCode(e.keyCode || e.which);

                    // We need alphabetic characters to make a match.
                    if (character.toUpperCase() === character.toLowerCase()) {
                        return;
                    }

                    // SHIFT doesn't usually give us a lowercase character. Check for this
                    // and for when we get a lowercase character when SHIFT is enabled.
                    if ((e.shiftKey && character.toLowerCase() === character) || (!e.shiftKey && character.toUpperCase() === character)) {
                        scope[attrs.capsOn] = true;
                    } else {
                        scope[attrs.capsOn] = false;
                    }
                });
            }
        };
    }

})();
