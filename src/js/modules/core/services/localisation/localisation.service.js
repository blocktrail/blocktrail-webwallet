/*(function () {
    "use strict";

    angular.module('blocktrail.core')
        .provider('blocktrailLocalisation', blocktrailLocalisation);
    
    function blocktrailLocalisation(pascalprechtTranslateOverrider, $windowProvider, $translateProvider, _) {
        var indexOf = function(array, searchElement) {
            for (var i = 0, len = array.length; i < len; i++) {
                if (array[i] === searchElement) {
                    return i;
                }
            }
            return -1;
        };

        // tries to determine the browsers language
        // from angular-translate, but it wasn't being exposed so we copied it
        var getFirstBrowserLanguage = function() {
            // internal purpose only
            if (angular.isFunction(pascalprechtTranslateOverrider.getLocale)) {
                return pascalprechtTranslateOverrider.getLocale();
            }

            var nav = $windowProvider.$get().navigator,
                browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'],
                i,
                language;

            // support for HTML 5.1 "navigator.languages"
            if (angular.isArray(nav.languages)) {
                for (i = 0; i < nav.languages.length; i++) {
                    language = nav.languages[i];
                    if (language && language.length) {
                        return language;
                    }
                }
            }

            // support for other well known properties in browsers
            for (i = 0; i < browserLanguagePropertyKeys.length; i++) {
                language = nav[browserLanguagePropertyKeys[i]];
                if (language && language.length) {
                    return language;
                }
            }

            return null;
        };
        // determines if preferred language can be matched to an available language
        // from angular-translate, but it wasn't being exposed so we copied it
        var negotiateLocale = function (preferred) {
            // from outer scope
            var $availableLanguageKeys = languages, $languageKeyAliases = aliases;

            var avail = [],
                locale = angular.lowercase(preferred),
                i = 0,
                n = $availableLanguageKeys.length;

            for (; i < n; i++) {
                avail.push(angular.lowercase($availableLanguageKeys[i]));
            }

            if (indexOf(avail, locale) > -1) {
                return preferred;
            }

            if ($languageKeyAliases) {
                var alias;
                for (var langKeyAlias in $languageKeyAliases) {
                    var hasWildcardKey = false;
                    var hasExactKey = Object.prototype.hasOwnProperty.call($languageKeyAliases, langKeyAlias) &&
                        angular.lowercase(langKeyAlias) === angular.lowercase(preferred);

                    if (langKeyAlias.slice(-1) === '*') {
                        hasWildcardKey = langKeyAlias.slice(0, -1) === preferred.slice(0, langKeyAlias.length-1);
                    }

                    if (hasExactKey || hasWildcardKey) {
                        alias = $languageKeyAliases[langKeyAlias];
                        if (indexOf(avail, angular.lowercase(alias)) > -1) {
                            return alias;
                        }
                    }
                }
            }

            if (preferred) {
                var parts = preferred.split('_');

                if (parts.length > 1 && indexOf(avail, angular.lowercase(parts[0])) > -1) {
                    return parts[0];
                }
            }

            // If everything fails, just return the preferred, unchanged.
            return preferred;
        };

        // enabled languages
        // languages should be added to CONFIG.LANGUAGES, not here
        // because when added here it won't result in a popup asking the user to switch to them
        var languages = [
            'en-US',
            'en'
        ];
        // language aliases used to map system language to a language key
        // mapping won't work without these so without a working alias languages will never be enabled
        var aliases = {
            'en-US': 'en-US',
            'en-*': 'en',
            'fr-*': 'fr',
            'nl-*': 'nl',
            'es-*': 'es',
            'ru-*': 'ru',
            'zh-cn': 'cn',
            'sw-*': 'sw',
            'ar-*': 'ar',
            'hi-*': 'hi'
        };

        // names used for translation keys
        var names = {
            nl: 'DUTCH',
            en: 'ENGLISH',
            'en-US': 'ENGLISH_US',
            fr: 'FRENCH',
            es: 'SPANISH',
            cn: 'CHINESE',
            ru: 'RUSSIAN',
            sw: 'SWAHILI',
            ar: 'ARABIC',
            hi: 'HINDI'
        };

        var languageName = function(langKey) {
            return names[langKey.replace("_", "-")];
        };

        var registerLanguages = function() {
            $translateProvider.registerAvailableLanguageKeys(languages, aliases);
        };

        var getLanguages = function() {
            return languages;
        };

        var enableLanguage = function(language, _aliases) {
            if (languages.indexOf(language) === -1) {
                languages.push(language);
                _.each(_aliases, function(v, k) {
                    aliases[k] = v;
                });

                registerLanguages();
            }
        };

        var isAvailableLanguage = function(language) {
            return languages.indexOf(language) !== -1;
        };

        var determinePreferredLanguage = function() {
            var r = negotiateLocale(getFirstBrowserLanguage());
            return r;
        };

        var preferredAvailableLanguage = function() {
            var preferredLanguage = determinePreferredLanguage();
            var r = isAvailableLanguage(preferredLanguage) ? preferredLanguage : null;
            return r;
        };

        var setupPreferredLanguage = function() {
            var language = preferredAvailableLanguage() || 'en';
            $translateProvider.preferredLanguage(language);

            return language;
        };

        var parseExtraLanguages = function(extraLanguages) {
            // filter out languages we already know
            var knownLanguages = getLanguages();
            var newLanguages = extraLanguages.filter(function(language) {
                return knownLanguages.indexOf(language) === -1;
            });

            if (newLanguages.length === 0) {
                return;
            }

            // enable extra languages
            _.each(newLanguages, function(newLanguage) {
                enableLanguage(newLanguage, {});
            });

            // determine (new) preferred language
            return [newLanguages, setupPreferredLanguage()];
        };

        // expose as provider
        this.isAvailableLanguage = isAvailableLanguage;
        this.preferredAvailableLanguage = preferredAvailableLanguage;
        this.getFirstBrowserLanguage = getFirstBrowserLanguage;
        this.setupPreferredLanguage = setupPreferredLanguage;
        this.enableLanguage = enableLanguage;
        this.registerLanguages = registerLanguages;
        this.determinePreferredLanguage = determinePreferredLanguage;
        this.languageName = languageName;
        this.getLanguages = getLanguages;
        this.parseExtraLanguages = parseExtraLanguages;

        // expose as service
        this.$get = function() {
            return {
                isAvailableLanguage: isAvailableLanguage,
                preferredAvailableLanguage: preferredAvailableLanguage,
                getFirstBrowserLanguage: getFirstBrowserLanguage,
                setupPreferredLanguage: setupPreferredLanguage,
                enableLanguage: enableLanguage,
                registerLanguages: registerLanguages,
                determinePreferredLanguage: determinePreferredLanguage,
                languageName: languageName,
                getLanguages: getLanguages,
                parseExtraLanguages: parseExtraLanguages
            };
        };
    }
})();*/
