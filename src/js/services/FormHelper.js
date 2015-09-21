angular.module('blocktrail.wallet')

    /*
     * a service that handles extra functionality on an ngForm
     */
    .service('FormHelper', function() {
        this.setAllDirty = function(form) {
            // sets form and all form controls to dirty state
            form.$setDirty();
            angular.forEach(form.$error, function(value, index) {
                angular.forEach(value, function(value, index) {
                    value.$dirty = true;
                    value.$pristine = false;
                });
            });
        };

        this.setAllPristine = function(form) {
            // sets form and all form controls to pristine state
            form.$setPristine();
            angular.forEach(form.$error.required, function(value, index) {
                value.$setPristine();
            });
        };

        this.setValidityOnce = function(formElement, key, val) {
            if (typeof formElement.$validators[key] === "undefined") {
                formElement.$validators[key] = function() { return true; };
            }

            formElement.$setValidity(key, val || false);
            formElement.$setDirty();
        };
    })
;
