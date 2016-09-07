angular.module('blocktrail.wallet').factory(
    'trackingService',
    function(CONFIG, $analytics) {

        return {
            trackLogin: function() {
                if (CONFIG.FBTRACKING_ID) {
                    if (!window.fbq) {
                        console.error("`fbq` doesn't exist!")
                    } else {
                        fbq('track', 'Other');
                    }
                }

                if (CONFIG.GOOGLEADWORDS_ID && CONFIG.GOOGLEADWORDS_LABEL) {}

                if (CONFIG.GOOGLEANALYTICS_ID) {
                    $analytics.eventTrack('login', {category: 'Events'});
                }
            },

            trackRegistration: function() {
                if (CONFIG.FBTRACKING_ID) {
                    if (!window.fbq) {
                        console.error("`fbq` doesn't exist!")
                    } else {
                        fbq('track', 'CompleteRegistration');
                    }
                }

                if (CONFIG.GOOGLEADWORDS_ID && CONFIG.GOOGLEADWORDS_LABEL) {
                    var image = new Image(1,1);
                    image.src = 'https://www.googleadservices.com/pagead/conversion/'+ CONFIG.GOOGLEADWORDS_ID +'/?label=' + CONFIG.GOOGLEADWORDS_LABEL + '&amp;guid=ON&amp;script=0';
                    document.body.appendChild(image);
                }

                if (CONFIG.GOOGLEANALYTICS_ID) {
                    $analytics.eventTrack('registration', {category: 'Events'});
                }
            }
        }
    }
);
