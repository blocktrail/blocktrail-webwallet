(function () {
    "use strict";

    angular.module('blocktrail.core')
        .config(localisationConfig);

    function localisationConfig($translateProvider, TRANSLATIONS, CONFIG, blocktrailLocalisationProvider) {
        $translateProvider.translations('en-US', processTranslations(angular.extend({}, TRANSLATIONS.english, TRANSLATIONS.americanEnglish)));
        $translateProvider.translations('en', processTranslations(TRANSLATIONS.english));
        $translateProvider.translations('fr', processTranslations(TRANSLATIONS.french));
        $translateProvider.translations('nl', processTranslations(TRANSLATIONS.dutch));
        $translateProvider.translations('ru', processTranslations(TRANSLATIONS.russian));
        $translateProvider.translations('cn', processTranslations(TRANSLATIONS.chinese));
        $translateProvider.translations('es', processTranslations(TRANSLATIONS.spanish));
        $translateProvider.translations('sw', processTranslations(TRANSLATIONS.swahili));
        $translateProvider.translations('ar', processTranslations(TRANSLATIONS.arabic));
        $translateProvider.translations('hi', processTranslations(TRANSLATIONS.hindi));

        if (CONFIG.FALLBACK_LANGUAGE) {
            $translateProvider.fallbackLanguage(CONFIG.FALLBACK_LANGUAGE);
        }

        $translateProvider.useSanitizeValueStrategy(['escapeParameters']);
        blocktrailLocalisationProvider.registerLanguages();
        blocktrailLocalisationProvider.setupPreferredLanguage();

        function processTranslations(translations) {
            var result = {};

            for(var prop in translations) {
                if (translations.hasOwnProperty(prop)) {
                    if (Array.isArray(translations[prop])) {
                        result[prop] = translations[prop].join("\n");
                    } else {
                        result[prop] = translations[prop];
                    }
                }
            }

            return result;
        }
    }

})();
