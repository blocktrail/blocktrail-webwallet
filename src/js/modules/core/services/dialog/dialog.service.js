(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('dialogService', function($modal, $rootScope) {
            return new DialogsManager($modal, $rootScope);
        });


    function DialogsManager($modal, $rootScope) {
        var self = this;

        // Mapping for object dependencies
        self._$modal = $modal;
        self._$rootScope = $rootScope;

        self.dialogId = 0;
    }

    DialogsManager.prototype.isCancel = function(err) {
        return (err === "CANCELED" || err === "dismiss" || err === "backdrop click");
    };

    DialogsManager.prototype.alert = function(title, body, ok, cancel) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, ok, cancel);

        var defaultBackdrop = message.cancel === false || message.ok === false ? 'static' : true;

        var modalInstance = self._$modal.open({
            controller: 'DialogAlertCtrl',
            templateUrl: 'templates/dialog/dialog.alert.html',
            size: message.size || 'md',
            backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
            resolve: {
                message: function() {
                    return message;
                },
                dialogId: function() {
                    return dialogId;
                }
            }
        });

        modalInstance.message = message;

        modalInstance.update = function(title, body, ok, cancel) {
            var message = self._getMessage(title, body, ok, cancel);
            
            self._$rootScope.$broadcast('dialog:' + dialogId, message);
        };

        return modalInstance;
    };

    DialogsManager.prototype.alertSingleton = function() {
        var self = this;

        var alert = function(title, body, ok, cancel) {
            if (!alert.modalInstance) {
                alert.modalInstance = self.alert(title, body, ok, cancel);
                alert.modalInstance.result.then(
                    function() { alert.modalInstance = null; },
                    function() { alert.modalInstance = null; }
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

    DialogsManager.prototype.prompt = function(title, body, ok, cancel) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, ok, cancel);


        if (typeof message.prompt === "undefined") {
            message.prompt = true;
        }

        var defaultBackdrop = message.cancel === false || message.ok === false ? 'static' : true;

        var modalInstance = self._$modal.open({
            controller: 'DialogPromptCtrl',
            templateUrl: 'templates/dialog/dialog.prompt.html',
            size: message.size || 'md',
            backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
            resolve: {
                message: function() {
                    return message;
                },
                dialogId: function() {
                    return dialogId
                }
            }
        });

        modalInstance.message = message;

        modalInstance.update = function(title, body, ok) {
            var message = self._getMessage(title, body, ok, cancel);

            self._$rootScope.$broadcast('dialog:' + dialogId, message);
        };

        return modalInstance;
    };

    DialogsManager.prototype.spinner = function(title, body) {
        var self = this;
        var dialogId = ++self.dialogId;
        var message = self._getMessage(title, body, false, false);

        if (typeof message.title === "undefined") {
            message.title = 'LOADING';
        }

        var defaultBackdrop = 'static';

        var modalInstance = self._$modal.open({
            controller: 'DialogSpinnerCtrl',
            templateUrl: 'templates/dialog/dialog.spinner.html',
            size: message.size || 'md',
            backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
            resolve: {
                message: function() {
                    return message;
                },
                dialogId: function() {
                    return dialogId
                }
            }
        });

        modalInstance.message = message;

        modalInstance.update = function(title, body) {
            var message = self._getMessage(title, body, false, false);

            self._$rootScope.$broadcast('dialog:' + dialogId, message);
        };

        return modalInstance;
    };

    DialogsManager.prototype._getMessage = function(title, body, ok, cancel) {
        var message;

        if (typeof title === "object") {
            message = title;

            if (typeof message.cancel === "undefined") {
                message.cancel = false;
            }
        } else {
            message = {
                title: title,
                body: body,
                ok: ok,
                cancel: typeof cancel === "undefined" ? false : cancel
            }
        }

        return message;
    }




























    /*angular.module('blocktrail.wallet').factory(
        'dialogService',
        function($modal, $rootScope, CONFIG) {
            var DialogService = function() {
                var self = this;

                self.dialogId = 0;
            };

            DialogService.prototype.isCancel = function(err) {
                return (err === "CANCELED" || err === "dismiss" || err === "backdrop click");
            };

            DialogService.prototype.alert = function(title, body, ok, cancel) {
                var self = this;
                var dialogId = ++self.dialogId;

                var message;
                if (typeof title === "object") {
                    message = title;

                    if (typeof message.cancel === "undefined") {
                        message.cancel = false;
                    }
                } else {
                    message = {
                        title: title,
                        body: body,
                        ok: ok,
                        cancel: typeof cancel === "undefined" ? false : cancel
                    }
                }

                var defaultBackdrop = message.cancel === false || message.ok === false ? 'static' : true;

                var modalInstance = $modal.open({
                    controller: 'DialogAlertCtrl',
                    templateUrl: 'templates/dialog/dialog.alert.html',
                    size: message.size || 'md',
                    backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
                    resolve: {
                        message: function() {
                            return message;
                        },
                        dialogId: function() {
                            return dialogId;
                        }
                    }
                });

                modalInstance.message = message;
                modalInstance.update = function(title, body, ok, cancel) {
                    var message;
                    if (typeof title === "object") {
                        message = title;

                        if (typeof message.cancel === "undefined") {
                            message.cancel = false;
                        }
                    } else {
                        message = {
                            title: title,
                            body: body,
                            ok: ok,
                            cancel: typeof cancel === "undefined" ? false : cancel
                        }
                    }

                    $rootScope.$broadcast('dialog:' + dialogId, message);
                };

                return modalInstance;
            };

            DialogService.prototype.alertSingleton = function() {
                var self = this;

                var alertt = function(title, body, ok, cancel) {
                    if (!alertt.modalInstance) {
                        alertt.modalInstance = self.alert(title, body, ok, cancel);
                        alertt.modalInstance.result.then(
                            function() { alertt.modalInstance = null; },
                            function() { alertt.modalInstance = null; }
                        );
                    } else {
                        alertt.modalInstance.update(title, body, ok, cancel);
                    }

                    return alertt.modalInstance;
                };
                alertt.modalInstance = null;

                alertt.dismiss = function() {
                    if (alertt.modalInstance) {
                        alertt.modalInstance.dismiss();
                    }
                }

                return alertt;
            };

            DialogService.prototype.prompt = function(title, body, ok, cancel) {
                var self = this;
                var dialogId = ++self.dialogId;

                var message;
                if (typeof title === "object") {
                    message = title;
                } else {
                    message = {
                        title: title,
                        body: body,
                        ok: ok,
                        cancel: cancel
                    }
                }

                if (typeof message.prompt === "undefined") {
                    message.prompt = true;
                }

                var defaultBackdrop = message.cancel === false || message.ok === false ? 'static' : true;

                var modalInstance = $modal.open({
                    controller: 'DialogPromptCtrl',
                    templateUrl: 'templates/dialog/dialog.prompt.html',
                    size: message.size || 'md',
                    backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
                    resolve: {
                        message: function() {
                            return message;
                        },
                        dialogId: function() {
                            return dialogId
                        }
                    }
                });

                modalInstance.message = message;
                modalInstance.update = function(title, body, ok) {
                    var message;
                    if (typeof title === "object") {
                        message = title;
                    } else {
                        message = {
                            title: title,
                            body: body,
                            ok: ok
                        }
                    }

                    $rootScope.$broadcast('dialog:' + dialogId, message);
                };

                return modalInstance;
            };

            DialogService.prototype.spinner = function(title, body) {
                var self = this;
                var dialogId = ++self.dialogId;

                var message;
                if (typeof title === "object") {
                    message = title;
                } else {
                    message = {
                        title: title,
                        body: body
                    }
                }

                if (typeof message.title === "undefined") {
                    message.title = 'LOADING';
                }

                var defaultBackdrop = 'static';

                var modalInstance = $modal.open({
                    controller: 'DialogSpinnerCtrl',
                    templateUrl: 'templates/dialog/dialog.spinner.html',
                    size: message.size || 'md',
                    backdrop: typeof message.backdrop !== "undefined" ? message.backdrop : defaultBackdrop,
                    resolve: {
                        message: function() {
                            return message;
                        },
                        dialogId: function() {
                            return dialogId
                        }
                    }
                });

                modalInstance.message = message;
                modalInstance.update = function(title, body) {
                    var message;
                    if (typeof title === "object") {
                        message = title;
                    } else {
                        message = {
                            title: title,
                            body: body
                        }
                    }

                    $rootScope.$broadcast('dialog:' + dialogId, message);
                };

                return modalInstance;
            };

            return new DialogService();
        }
    );*/

})();
