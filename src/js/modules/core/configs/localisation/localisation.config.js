(function () {
    "use strict";

    angular.module("blocktrail.core")
        .config(localisationConfig);

    function localisationConfig($translateProvider, TRANSLATIONS, CONFIG, blocktrailLocalisationProvider) {
        $translateProvider.translations("en-US", processTranslations(angular.extend({}, TRANSLATIONS.english, TRANSLATIONS.americanEnglish)));
        $translateProvider.translations("en", processTranslations(TRANSLATIONS.english));
        $translateProvider.translations("fr", processTranslations(TRANSLATIONS.french));
        $translateProvider.translations("nl", processTranslations(TRANSLATIONS.dutch));
        $translateProvider.translations("ru", processTranslations(TRANSLATIONS.russian));
        $translateProvider.translations("cn", processTranslations(TRANSLATIONS.chinese));
        $translateProvider.translations("es", processTranslations(TRANSLATIONS.spanish));
        $translateProvider.translations("sw", processTranslations(TRANSLATIONS.swahili));
        $translateProvider.translations("ar", processTranslations(TRANSLATIONS.arabic));
        $translateProvider.translations("hi", processTranslations(TRANSLATIONS.hindi));

        if (CONFIG.FALLBACK_LANGUAGE) {
            $translateProvider.fallbackLanguage(CONFIG.FALLBACK_LANGUAGE);
        }

        $translateProvider.useSanitizeValueStrategy(["escapeParameters"]);
        blocktrailLocalisationProvider.registerLanguages();
        blocktrailLocalisationProvider.setupPreferredLanguage();

        function processTranslations(translations) {
            var result = {};

            angular.forEach(translations, function(value, key) {
                if (Array.isArray(value)) {
                    result[key] = value.join("\n");
                } else {
                    result[key] = value;
                }
            });

            return result;
        }
    }

})();
