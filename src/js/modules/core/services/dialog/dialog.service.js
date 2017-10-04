(function() {
    "use strict";

    angular.module("blocktrail.wallet")
        .factory("dialogService", function($modal, $rootScope) {
            return new DialogsManager($modal, $rootScope);
        });

    function DialogsManager($modal, $rootScope) {
        var self = this;

        // Mapping for object dependencies
        self._$modal = $modal;
        self._$rootScope = $rootScope;

        self.dialogId = 0;
    }

    /**
     * Is cancel
     * @param err
     * @return {boolean}
     */
    DialogsManager.prototype.isCancel = function(err) {
        return (err === "CANCELED" || err === "dismiss" || err === "backdrop click");
    };

    /**
     * Alert
     * @param title
     * @param body
     * @param ok
     * @param cancel
     */
    DialogsManager.prototype.alert = function(title, body, ok, cancel) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, ok, cancel);
        var modalInstance = self._getModalInstanceByType("alert", message, dialogId);

        modalInstance.message = message;

        modalInstance.update = function(title, body, ok, cancel) {
            var message = self._getMessage(title, body, ok, cancel);

            self._$rootScope.$broadcast("dialog:" + dialogId, message);
        };

        return modalInstance;
    };

    /**
     * Alert singleton
     * @return {alert}
     */
    DialogsManager.prototype.alertSingleton = function() {
        var self = this;

        var alert = function(title, body, ok, cancel) {
            if (!alert.modalInstance) {
                alert.modalInstance = self.alert(title, body, ok, cancel);
                alert.modalInstance.result.then(
                    function() {
                        alert.modalInstance = null;
                    },
                    function() {
                        alert.modalInstance = null;
                    }
                );
            } else {
                alert.modalInstance.update(title, body, ok, cancel);
            }

            return alert.modalInstance;
        };

        alert.modalInstance = null;

        alert.dismiss = function() {
            if (alert.modalInstance) {
                alert.modalInstance.dismiss();
            }
        };

        return alert;
    };

    /**
     * Prompt
     * @param title
     * @param body
     * @param ok
     * @param cancel
     */
    DialogsManager.prototype.prompt = function(title, body, ok, cancel) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, ok, cancel, true);

        if (typeof message.prompt === "undefined") {
            message.prompt = true;
        }

        var modalInstance = self._getModalInstanceByType("prompt", message, dialogId);

        modalInstance.message = message;

        modalInstance.update = function(title, body, ok) {
            var message = self._getMessage(title, body, ok, cancel, true);

            self._$rootScope.$broadcast("dialog:" + dialogId, message);
        };

        return modalInstance;
    };

    /**
     * Spinner
     * @param title
     * @param body
     */
    DialogsManager.prototype.spinner = function(title, body) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, false, false);

        if (typeof message.title === "undefined") {
            message.title = "LOADING";
        }

        var modalInstance = self._getModalInstanceByType("spinner", message, dialogId);

        modalInstance.message = message;

        modalInstance.update = function(title, body) {
            var message = self._getMessage(title, body, false, false);

            self._$rootScope.$broadcast("dialog:" + dialogId, message);
        };

        return modalInstance;
    };

    /**
     * Get message
     * @param title
     * @param body
     * @param ok
     * @param cancel
     * @param cancelDefault   when cancel is undefined this value is used
     * @return {*}
     * @private
     */
    DialogsManager.prototype._getMessage = function(title, body, ok, cancel, cancelDefault) {
        var message;

        if (typeof title === "object") {
            message = title;

            if (typeof message.ok === "undefined") {
                message.ok = true;
            }
            if (typeof message.cancel === "undefined") {
                message.cancel = cancelDefault;
            }
        } else {
            message = {
                title: title,
                body: body,
                ok: typeof ok === "undefined" ? true : ok,
                cancel: typeof cancel === "undefined" ? cancelDefault : cancel
            };
        }

        return message;
    };

    /**
     * Get modal instance
     * @param type
     * @param message
     * @param id
     * @private
     */
    DialogsManager.prototype._getModalInstanceByType = function(type, message, id) {
        var self = this;
        var controllerName = "";
        var templateUrl = "";

        var defaultBackdrop = message.cancel === false || message.ok === false ? "static" : true;

        switch (type) {
            case "alert":
                controllerName = "DialogAlertModalCtrl";
                templateUrl = "js/modules/core/controllers/dialog-alert-modal/dialog-alert-modal.tpl.html";
                break;
            case "prompt":
                controllerName = "DialogPromptModalCtrl";
                templateUrl = "js/modules/core/controllers/dialog-prompt-modal/dialog-prompt-modal.tpl.html";
                break;
            case "spinner":
                controllerName = "DialogSpinnerModalCtrl";
                templateUrl = "js/modules/core/controllers/dialog-spinner-modal/dialog-spinner-modal.tpl.html";
                break;
            default:
                throw new Error("Modal type should be defined. Blocktrail core module, dialog service.");
        }

        return self._$modal.open({
            controller: controllerName,
            templateUrl: templateUrl,
            size: message.size || "md",
            backdrop: message.backdrop ? message.backdrop : defaultBackdrop,
            resolve: {
                message: function() {
                    return message;
                },
                dialogId: function() {
                    return id;
                }
            }
        });
    };
})();
