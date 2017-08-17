(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .directive("wTransactionAvatar", wTransactionAvatar);

    function wTransactionAvatar() {
        return {
            restrict: "E",
            replace: true,
            scope: {
                transaction: "="
            },
            templateUrl: "js/modules/wallet/directives/w-transaction-avatar/w-transaction-avatar.tpl.html",
            controller: wTransactionAvatarCtrl
        };
    }

    function wTransactionAvatarCtrl($scope, CONFIG, buyBTCService) {
        $scope.contactInitials = "";
        $scope.defaultAvatarUrl = CONFIG.STATICSURL + "/img/blank_profile.png";
        $scope.avatarUrl= "";
        $scope.isReceived = $scope.transaction["wallet_value_change"] > 0;

        var brokerDisplayName = "";

        if (!$scope.transaction.contact && $scope.transaction.buybtc) {
            var broker = buyBTCService.BROKERS[$scope.transaction.buybtc.broker];

            brokerDisplayName = broker.displayName;
            $scope.avatarUrl = broker.avatarUrl;
        }

        if ($scope.transaction.contact) {
            var firstName = $scope.transaction.contact["firstName"];
            var lastName = $scope.transaction.contact["lastName"];

            if (!lastName && firstName) {
                $scope.contactInitials = firstName.substr(0, 2);
            } else if (!firstName && lastName) {
                $scope.contactInitials = lastName.substr(0, 2);
            } else if (firstName && lastName) {
                $scope.contactInitials = firstName.substr(0, 1) + lastName.substr(0, 1);
            } else if (brokerDisplayName) {
                $scope.contactInitials = brokerDisplayName.substr(0, 2);
            }
        }
    }

})();
