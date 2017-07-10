/*
(function () {
    "use strict";

    angular.module('blocktrail.core')
        .config(localisationConfig);

    function localisationConfig($translateProvider, TRANSLATIONS, CONFIG, blocktrailLocalisationProvider) {
        var processTranslations = function(translations) {
            _.forEach(translations, function(v, k) {
                // merged arrays with newlines
                if (_.isArray(v)) {
                    translations[k] = v.join("\n");
                }
            });

            return translations;
        };

        var english = angular.extend({}, TRANSLATIONS.english);
        var americanEnglish = angular.extend({}, english, TRANSLATIONS.americanEnglish);
        var french = angular.extend({}, TRANSLATIONS.french);
        var dutch = angular.extend({}, TRANSLATIONS.dutch);
        var spanish = angular.extend({}, TRANSLATIONS.spanish);
        var russian = angular.extend({}, TRANSLATIONS.russian);
        var chinese = angular.extend({}, TRANSLATIONS.chinese);
        var swahili = angular.extend({}, TRANSLATIONS.swahili);
        var arabic = angular.extend({}, TRANSLATIONS.arabic);
        var hindi = angular.extend({}, TRANSLATIONS.hindi);

        $translateProvider.translations('en-US', processTranslations(americanEnglish));
        $translateProvider.translations('en', processTranslations(english));
        $translateProvider.translations('fr', processTranslations(french));
        $translateProvider.translations('nl', processTranslations(dutch));
        $translateProvider.translations('ru', processTranslations(russian));
        $translateProvider.translations('cn', processTranslations(chinese));
        $translateProvider.translations('es', processTranslations(spanish));
        $translateProvider.translations('sw', processTranslations(swahili));
        $translateProvider.translations('ar', processTranslations(arabic));
        $translateProvider.translations('hi', processTranslations(hindi));

        if (CONFIG.FALLBACK_LANGUAGE) {
            $translateProvider.fallbackLanguage(CONFIG.FALLBACK_LANGUAGE);
        }

        $translateProvider.useSanitizeValueStrategy(['escapeParameters']);
        blocktrailLocalisationProvider.registerLanguages();
        blocktrailLocalisationProvider.setupPreferredLanguage();
    }
})();
*/
