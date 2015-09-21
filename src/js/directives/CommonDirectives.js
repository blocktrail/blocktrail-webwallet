angular.module('blocktrail.wallet')
    .directive('rawModel', function($parse) {
        //assigns the raw value of the element's ng-model to the given scope model
        return {
            restrict: "A",
            require: 'ngModel',
            scope: "=",
            link: function(scope, elem, attrs, ngModel) {
                //get the model to update with the raw value
                var updateModel = $parse(attrs.rawModel);

                ngModel.$parsers.unshift(function(value) {
                    //console.log('parse', value, ngModel.$viewValue);
                    updateModel.assign(scope, ngModel.$viewValue);
                    return value;
                });
                ngModel.$formatters.unshift(function(value) {
                    //console.log('format', value);
                    updateModel.assign(scope, ngModel.$modelValue);
                    return value;
                });
            }
        };
    })
    .directive('selectOnFocus', function() {
        //clear the input value on focus if input is pristine (used to remove the initial 0 on send input)
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                element.on('focus', function() {
                    if (ngModel.$pristine) {
                        ngModel.$setViewValue();
                        ngModel.$setPristine();
                        ngModel.$render();
                    }
                });
                element.on('blur', function() {
                    if (ngModel.$pristine) {
                        ngModel.$setViewValue(0);
                        ngModel.$setPristine();
                        ngModel.$render();
                    }
                });
            }
        };
    })
    .directive('ngEnter', function() {
        //captures enter key press and evaluates the given arguments
        return function(scope, element, attrs) {
            element.bind("keydown keypress", function(event) {
                if (event.which == 13) {
                    scope.$apply(function() {
                        scope.$eval(attrs.ngEnter, {$event: event});
                    });
                    event.preventDefault();
                }
            });
        };
    })
    .directive('ngTab', function() {
        //captures enter key press and evaluates the given arguments
        return function(scope, element, attrs) {
            element.bind("keydown keypress", function(event) {
                if (event.which == 9) {
                    scope.$apply(function() {
                        scope.$eval(attrs.ngTab, {$event: event});
                    });
                    event.preventDefault();
                }
            });
        };
    })
    .directive('convertToNumber', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(val) {
                    return parseInt(val, 10);
                });
                ngModel.$formatters.push(function(val) {
                    return '' + val;
                });
            }
        };
    })
    .directive('loadingSpinner', function() {
        return {
            restrict: 'EA',
            transclude: false,
            scope: {
                loadingSpinnerSize: '@'
            },
            template: '<div class="loading-spinner loading-spinner-{{ loadingSpinnerSize }}">' +
            '<div class="loading loading-0"></div>' +
            '<div class="loading loading-1"></div>' +
            '<div class="loading loading-2"></div>' +
            '</div>'
        };
    })
    .factory('maximizeHeightStack', function($timeout) {
        var stack = [];

        var adjust = function() {
            stack.forEach(function(elem) {
                var parent = angular.element(elem).parent()[0];
                var parentStyle = window.getComputedStyle(parent, null);
                var parentHeight = parseInt(parentStyle.getPropertyValue("height").replace("px"), 10);
                var parentPaddingTop = parseInt(parentStyle.getPropertyValue("padding-top").replace("px"), 10);
                var parentPaddingBottom = parseInt(parentStyle.getPropertyValue("padding-bottom").replace("px"), 10);

                var elemStyle = window.getComputedStyle(elem, null);
                var elemMarginTop = parseInt(elemStyle.getPropertyValue("margin-top").replace("px"), 10);
                var elemMarginBottom = parseInt(elemStyle.getPropertyValue("margin-bottom").replace("px"), 10);

                var newHeight = parentHeight - parentPaddingTop - parentPaddingBottom - elemMarginBottom - elemMarginTop;

                angular.element(elem).css('min-height', (newHeight + elem.maximizeHeightOffset) + 'px');
            });
        };

        window.adjust = adjust;

        var reorder = function() {
            var newStack = [];

            stack.forEach(function(elem, idx) {
                var injected = false;

                newStack.forEach(function(_elem, _idx) {
                    if (injected) { return; }

                    if (angular.element(elem).parent()[0] == _elem) {
                        newStack.splice(_idx+1, 0, elem);
                        injected = true;
                    } else if (angular.element(_elem).parent()[0] == elem) {
                        newStack.splice(_idx, 0, elem);
                        injected = true;
                    }
                });

                if (!injected) {
                    newStack.push(elem);
                }
            });

            stack = newStack;
        };

        return {
            register: function(elem) {
                stack.push(elem);

                reorder();
                adjust();
            },
            unregister: function(elem) {
                var idx = stack.indexOf(elem);

                if (idx !== -1) {
                    stack.splice(idx, 1);
                }
            }
        }
    })

    .directive('maximizeHeight', function(maximizeHeightStack) {
        return {
            restrict: 'A',
            scope: false,
            link: function(scope, elem, attrs) {
                scope.$on('$destroy', function() {
                    maximizeHeightStack.unregister(elem[0]);
                });

                elem[0].maximizeHeightOffset = attrs.maximizeHeight ? parseInt(attrs.maximizeHeight, 10) : 0;

                maximizeHeightStack.register(elem[0]);
            }
        };
    }
)

;

angular.module('blocktrail.wallet').directive(
    'focusOn',

    function($timeout) {
        return {
            link: function(scope, element, attr) {
                // set focus initially
                $timeout(function() {
                    if (element.visible(true)) {
                        element[0].focus();
                    }
                },50);

                // when focusOn event is broadcasted we're checking if we're the field that should be focused
                scope.$on('focusOn', function(event, value) {
                    if(value == attr.focusOn) {
                        // use $timeout to make sure we're not setting focus before field is visible
                        $timeout(function() {
                            element[0].focus();
                        });
                    }
                });
            }
        };
    }
);

angular.module('blocktrail.wallet').factory(
    'setFocusOn',

    function ($rootScope, $timeout) {
        return function(name) {
            // use $timeout to make sure we're not setting focus before field is visible
            $timeout(function() {
                // broadcast the field that should be focused
                $rootScope.$broadcast('focusOn', name);
            });
        };
    }
);

angular.module('blocktrail.wallet').directive(
    'capsOn',

    function() {
        return {
            link: function(scope, element, attrs) {
                if (attrs.capsOnBlurNull) {
                    element.on('blur', function() {
                        scope[attrs.capsOn] = null;
                    });
                }

                element.on('keypress', function(e) {
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
);

angular.module('blocktrail.wallet').directive(
    'btFileUpload',

    function() {
        return {
            link: function(scope, element, attrs) {
                var handleFileSelect = function(evt) {
                    scope.$emit('fileUpload:start', attrs.btFileUpload);

                    var file = evt.currentTarget.files[0];
                    var reader = new FileReader();
                    reader.onload = function(evt) {
                        scope.$emit('fileUpload:done', attrs.btFileUpload, evt.target.result);
                    };

                    reader.readAsDataURL(file);
                };

                angular.element(element).on('change', handleFileSelect);
            }
        };
    }
);
