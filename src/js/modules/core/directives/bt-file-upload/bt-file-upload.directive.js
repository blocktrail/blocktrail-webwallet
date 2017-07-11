(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("btFileUpload", btFileUpload);

    function btFileUpload() {
        return {
            link: function(scope, element, attrs) {
                var handleFileSelect = function(evt) {
                    scope.$emit("fileUpload:start", attrs.btFileUpload);

                    var file = evt.currentTarget.files[0];
                    var reader = new FileReader();
                    reader.onload = function(evt) {
                        scope.$emit("fileUpload:done", attrs.btFileUpload, evt.target.result);
                    };

                    reader.readAsDataURL(file);
                };

                angular.element(element).on("change", handleFileSelect);
            }
        };
    }

})();
