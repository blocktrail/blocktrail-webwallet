(function () {
    "use strict";

    angular.module("blocktrail.setup")
        .controller("SetupLoggedoutCtrl", SetupLoggedoutCtrl);

    function SetupLoggedoutCtrl($scope, CONFIG) {
        $scope.CONFIG = CONFIG;
    }
})();
