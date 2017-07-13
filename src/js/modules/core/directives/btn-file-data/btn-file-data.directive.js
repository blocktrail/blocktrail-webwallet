(function () {
    "use strict";

    angular.module("blocktrail.core")
        .directive("btnFileData", btnFileData);

    function btnFileData() {
        return {
            restrict: 'EA',
            replace: true,
            transclude: true,
            scope: {
                btnFileDataName: "=",
                btnFileDataUpdate: "&"
            },
            templateUrl: "js/modules/core/directives/btn-file-data/btn-file-data.tpl.html",
            link: function(scope, element) {
                var inputFile = element.find('input');

                inputFile.on("change", handleFileSelect);

                scope.triggerClickOnInputFile = function () {
                    inputFile[0].click();
                };

                function handleFileSelect(evt) {
                    // TODO Check on file extension
                    var file = evt.currentTarget.files[0];
                    var reader = new FileReader();

                    reader.onload = function(evt) {
                        // Reset input
                        inputFile.val(null);

                        scope.btnFileDataUpdate({
                            name: scope.btnFileDataName,
                            data: evt.target.result
                        });
                    };

                    reader.readAsDataURL(file);
                }
            }
        };
    }




})();
