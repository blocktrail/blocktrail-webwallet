angular.module("blocktrail.wallet")
    .controller("SettingsProfileCtrl", SettingsProfileCtrl);

function SettingsProfileCtrl($scope, $rootScope, $translate, dialogService, CONFIG, $modal, formSettingsService, settingsService) {

    var savedSettings = {
        username: "",
        email: "",
        localCurrency: "USD",
        language: "en",
        receiveNewsletter: false,
        profilePic: null
    };

    var listenerFormSettings;

    $scope.hasEmailChanged = false;
    $scope.securityInfo = {};

    $rootScope.pageTitle = 'SETTINGS';

    // this automatically updates an already open modal instead of popping a new one open
    // TODO remove it after moving modals change password, enable/disable 2FA
    $scope.alert = dialogService.alertSingleton();

    $scope.isLoading = true;
    $scope.isSubmitFormSettingsBtnDisabled = true;

    $scope.formSettings = {
        username: "",
        email: "",
        localCurrency: "USD",
        language: "en",
        receiveNewsletter: false,
        profilePic: "/" + CONFIG.STATICSURL + "/img/blank_profile.png"
    };

    $scope.errors = {
        email: false,
        name: false
    };

    // $scope.languages = formSettingsService.getLanguages();
    // $scope.currencies = formSettingsService.getCurrencies();

    // Methods
    $scope.onChangeCurrency = onChangeCurrency;
    $scope.onChangeLanguage = onChangeLanguage;
    $scope.onFileDataUpdate = onFileDataUpdate;
    $scope.onResetError = onResetError;
    $scope.onSubmitFormSettings = onSubmitFormSettings;

    formSettingsService.fetchData()
       .then(initData);

    /**
     * Init data
     *
     * @param data
     */
    function initData(data) {

        console.log('data printed in profile ctrl', data);

        $scope.currencies = data.currencies;
        $scope.languages = data.languages;

        $scope.formSettings = angular.copy(data.settings);

        savedSettings = angular.copy(data.settings);

        // Add watcher
        listenerFormSettings = $scope.$watch('formSettings', isSubmitFormSettingsBtnDisabled, true);

        $scope.isLoading = false;
    }

    /**
     * Change currency
     *
     * @param $event
     * @param currency
     */
    function onChangeCurrency($event, currency) {
        $event.preventDefault();

        if (currency !== $scope.formSettings.localCurrency) {
            $scope.formSettings.localCurrency = currency;
        }
    }

    /**
     * Change language
     *
     * @param $event
     * @param languageCode
     */
    function onChangeLanguage($event, languageCode) {
        $event.preventDefault();

        if (languageCode !== $scope.formSettings.language) {
            $scope.formSettings.language = languageCode;
        }
    }

    /**
     * File data update
     * callback after we load an image source
     *
     * @param name
     * @param data
     */
    function onFileDataUpdate(name, data) {
        if (name === "profileIcon") {
            openCropImageModal(data);
        }
    }

    /**
     * Reset error
     */
    function onResetError(key) {
        if ($scope.errors[key]) {
            $scope.errors[key] = false;
        }
    }

    /**
     * Submit form
     */
    function onSubmitFormSettings() {
        // TODO Create validation service, add custom validation directives (provide array of rule's names and model)
        var emailRule = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
        var stringOrEmptyRule = /(^[a-zA-Z\d]+$)|(^$)/;

        resetErrors();

        if (!emailRule.test($scope.formSettings.email)) {
            $scope.errors.email = true;
            emailErrorModal();
        }

        if ($scope.formSettings.username.length && ($scope.formSettings.username.length < 4 || !stringOrEmptyRule.test($scope.formSettings.username))) {
            $scope.errors.name = true;
            usernameErrorModal();
        }

        if (!$scope.errors.email && !$scope.errors.name) {
            var saveObj = {};

            $scope.isLoading = true;

            // Send only changed data
            angular.forEach($scope.formSettings, function (val, key) {
                if (savedSettings[key] !== val) {
                    saveObj[key] = val;
                }
            });

            // Convert receive news letter boolean flag to integers
            if (angular.isDefined(saveObj.receiveNewsletter)) {
                saveObj.receiveNewsletter = saveObj.receiveNewsletter ? 1 : 0;
            }

            // Check if email has been changed
            if (savedSettings.email !== saveObj.email) {
                $scope.hasEmailChanged = true;
            }

            // Check if email has been changed, trigger verify mail
            formSettingsService.saveData(saveObj)
                .then(saveDataSuccessHandler, saveDataErrorHandler);
        }
    }

    /**
     * Handler on save success
     */
    function saveDataSuccessHandler() {
        $scope.isLoading = false;
        $scope.isSubmitFormSettingsBtnDisabled = true;

        if ($scope.hasEmailChanged) {
            settingsService.updateSettingsUp({
                pendingEmailVerification: true
            });

            // Do not return, as saveData() would not be called then
            dialogService.alert(
                $translate.instant("EMAIL_VERIFY"),
                $translate.instant("MSG_EMAIL_VERIFY")
            ).result;
        }

        // Update language if it was changed
        if ($scope.formSettings.language !== savedSettings.language) {
            $rootScope.changeLanguage($scope.formSettings.language);
        }

        savedSettings = angular.copy($scope.formSettings);
    }

    /**
     * Handler on save error
     */
    function saveDataErrorHandler(e) {
        $scope.isLoading = false;
        $scope.hasEmailChanged = false;

        dialogService.alert({
            title: $translate.instant('SETTINGS'),
            body: e.message || e
        });
    }

    /**
     * Is submit form settings button disabled
     */
    function isSubmitFormSettingsBtnDisabled() {
        $scope.isSubmitFormSettingsBtnDisabled = angular.equals(savedSettings, $scope.formSettings);
    }

    /**
     * Reset errors
     */
    function resetErrors() {
        $scope.errors.email = false;
        $scope.errors.name = false;
    }

    /**
     * Open modal window and crop the image
     *
     * @param data
     */
    function openCropImageModal(data) {
        var modalInstance = $modal.open({
            controller: "ModalCropImageCtrl",
            templateUrl: "js/modules/wallet/controllers/modal-crop-image/modal-crop-image.tpl.html",
            windowClass: 'modal-max-height',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                imgData: function () {
                    return data;
                }
            }
        });

        modalInstance.result.then(updateProfilePic);
    }

    /**
     * Update profile pic, handler for crop image modal window
     *
     * @param data
     */
    function updateProfilePic(data) {
        $scope.formSettings.profilePic = data;
    }

    // TODO move to modal controller
    function usernameErrorModal() {
        return dialogService.alert(
            $translate.instant('ERROR_TITLE_2'),
            $translate.instant('MSG_INVALID_USERNAME')
        ).result;
    }

    // TODO move to modal controller
    function emailErrorModal() {
        return dialogService.alert(
            $translate.instant('ERROR_TITLE_2'),
            $translate.instant('MSG_BAD_EMAIL')
        ).result;
    }

    $scope.$on('$destroy', function () {
        // Remove existing listeners
        if (listenerFormSettings) {
            listenerFormSettings();
        }
    });
}