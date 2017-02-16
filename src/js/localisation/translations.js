angular.module('blocktrail.localisation', [
    'pascalprecht.translate',
    'blocktrail.translations',
    'blocktrail.config'
])
    .config(function($translateProvider, TRANSLATIONS, CONFIG) {
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

        $translateProvider.translations('en_US', processTranslations(americanEnglish));
        $translateProvider.translations('en', processTranslations(english));
        $translateProvider.translations('fr', processTranslations(french));
        $translateProvider.translations('nl', processTranslations(dutch));
        $translateProvider.translations('ru', processTranslations(russian));
        $translateProvider.translations('cn', processTranslations(chinese));
        $translateProvider.translations('es', processTranslations(spanish));

        if (CONFIG.FALLBACK_LANGUAGE) {
            $translateProvider.fallbackLanguage(CONFIG.FALLBACK_LANGUAGE);
        }

        $translateProvider.useSanitizeValueStrategy(['escapeParameters']);
        $translateProvider.registerAvailableLanguageKeys(['en', 'fr', 'es', 'nl', 'ru', 'cn'], {
            'en_*': 'en',
            'fr_*': 'fr',
            'nl_*': 'nl',
            'ru_*': 'ru',
            'cn_*': 'cn'
        });

        // $translateProvider.determinePreferredLanguage();
        $translateProvider.preferredLanguage('en'); // hardcoded until we're ready to release
    });
