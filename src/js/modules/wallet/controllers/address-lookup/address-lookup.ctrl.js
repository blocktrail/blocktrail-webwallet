(function () {
    "use strict";

    angular.module("blocktrail.wallet")
        .controller("AddressLookupCtrl", AddressLookupCtrl);

    function AddressLookupCtrl($scope, $rootScope, dialogService, $translate, sdkService, bitcoinJS, activeWallet,
                               $q, $cacheFactory, CONFIG) {
        var walletData = activeWallet.getReadOnlyWalletData();

        var cache = $cacheFactory.get('address-lookup') || $cacheFactory('address-lookup', { capacity: 10 });

        var listenerGroupValues;

        this._sdkService = sdkService;
        $rootScope.pageTitle = 'ADDRESS_LOOKUP';

        $scope.useCashAddress = !CONFIG.NETWORKS[walletData.networkType].CASHADDRESS;

        $scope.items = [];
        $scope.totalItems = null;
        $scope.itemsPerPage = 15;
        $scope.currentPage = 1;

        // Search related
        $scope.searchText = "";
        $scope.isLoading = true;
        $scope.isPageLoading = false;
        $scope.checkOnlyUsed = false;
        $scope.checkOnlyLabeled = false;
        $scope.searchSortOrder = 'asc';

        $scope.alert = dialogService.alertSingleton();

        // Methods
        $scope.addLabel = addLabel;
        $scope.removeLabel = removeLabel;

        $scope.$on("$destroy", onDestroy);

        initData();

        /**
         * Init data
         */
        function initData() {
            filterAddresses(
                $scope.currentPage,
                $scope.itemsPerPage,
                $scope.searchSortOrder,
                $scope.searchText,
                $scope.checkOnlyUsed,
                $scope.checkOnlyLabeled
            )
                .then(function (addrs) {
                    $scope.items = addrs.data;
                    $scope.totalItems = addrs.total;
                    $scope.pagesCount = Math.ceil($scope.totalItems / $scope.itemsPerPage);
                    $scope.isLoading = false;

                    listenerGroupValues = $scope.$watchGroup(['searchText', 'checkOnlyUsed', 'checkOnlyLabeled', 'currentPage'], getNewAddresses);
                });
        }

        /**
         * Filters addresses (uses pagination, max 20 res per request) by a search text, usage and labels.
         * @param page Page of search results
         * @param limit Limit of results per page (max 20)
         * @param sort_dir Sort order ('asc' or 'desc')
         * @param searchText Search for this text (in addresses and labels)
         * @param hideUnused Hide unused addresses
         * @param hideUnlabeled Hide unlabeled addresses
         */
        function filterAddresses(page, limit, sort_dir, searchText, hideUnused, hideUnlabeled) {
            if (!searchText) searchText = "";

            var cacheKey = [searchText, limit, sort_dir, hideUnused, hideUnlabeled, page].join(":");
            var cached = cache.get(cacheKey);

            return $q.when(cached)
                .then(function(cached) {
                    if (cached) {
                        return cached;
                    } else {
                        var options = {
                            page: page,
                            limit: limit,
                            sort_dir: sort_dir,
                            hide_unused: hideUnused,
                            hide_unlabeled: hideUnlabeled
                        };

                        if (searchText.length > 0) {
                            options.search = searchText;
                            options.search_label = searchText;
                        }

                        return activeWallet.getSdkWallet()
                            .addresses(options)
                            .then(function (addrs) {
                                cache.put(cacheKey, addrs);
                                return addrs;
                            });
                    }
                });
        }

        /**
         * Get new addresses
         */
        function getNewAddresses(newValue, oldValue) {
            if (newValue !== oldValue) {
                $scope.isPageLoading = true;

                filterAddresses(
                    $scope.currentPage,
                    $scope.itemsPerPage,
                    $scope.searchSortOrder,
                    $scope.searchText,
                    $scope.checkOnlyUsed,
                    $scope.checkOnlyLabeled
                )
                    .then(function (addrs) {
                        $scope.items = addrs.data;
                        $scope.totalItems = addrs.total;
                        $scope.pagesCount = Math.ceil($scope.totalItems / $scope.itemsPerPage);

                        $scope.isPageLoading = false;
                    });
            }
        }

        /**
         * Add label
         * @param addrNumber
         */
        function addLabel(addrNumber) {
            return dialogService.prompt({
                    title: $translate.instant('EDIT_LABEL'),
                    body: $translate.instant('ENTER_NEW_LABEL'),
                    input_type: 'text',
                    icon: '',
                    prefill: $scope.items[addrNumber].label || ""
                })
                .result
                .then(function(data) {
                    if(data.length > 100) {
                        $scope.alert({
                            title: $translate.instant('EDIT_LABEL'),
                            body: $translate.instant('LABEL_MAX_LENGTH_INFO'),
                            ok: $translate.instant('OK')
                        });
                    } else {
                        return activeWallet.getSdkWallet()
                            .labelAddress($scope.items[addrNumber].address, data)
                            .then(function () {
                                // flush cache
                                cache.removeAll();
                                $scope.items[addrNumber].label = data;
                                return activeWallet.forcePolling();
                            })
                            .catch(function(err) {
                                // TODO Show the message.
                            });
                    }
                });
        }

        /**
         * Remove label
         * @param addrNumber
         */
        function removeLabel(addrNumber) {
            return dialogService.alert({
                title: $translate.instant('DELETE_LABEL'),
                body: $translate.instant('CONFIRM_DELETE_LABEL_QUESTION'),
                ok: $translate.instant('OK'),
                cancel: $translate.instant('CANCEL')
            })
                .result
                .then(function() {
                    return activeWallet.getSdkWallet()
                        .labelAddress($scope.items[addrNumber].address, "")
                        .then(function() {
                            // flush cache
                            cache.removeAll();
                            $scope.items[addrNumber].label = "";
                            return activeWallet.forcePolling();
                        });
            });
        }

        /**
         * On destroy
         */
        function onDestroy() {
            cache.removeAll();

            if(listenerGroupValues) {
                listenerGroupValues();
            }
        }
    }
})();
