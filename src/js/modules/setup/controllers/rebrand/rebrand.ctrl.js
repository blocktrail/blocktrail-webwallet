(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupRebrandCtrl", SetupRebrandCtrl);

    function SetupRebrandCtrl($scope, $stateParams) {
        $scope.goto = $stateParams.goto;
    }
})();
