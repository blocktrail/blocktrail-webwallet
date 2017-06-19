angular.module('blocktrail.wallet')
    .factory('trackingService', function(CONFIG, $analytics) {

        var EVENTS = {
            REGISTRATION: "registration",
            LOGIN: "login",
            RECEIVE_CUSTOM_AMOUNT: "receive_custom_amount",
            BUYBTC: {
                REGION_OK: "region_ok",
                REGION_NOTOK: "region_notok",
                GLIDERA_SETUP_INIT: "glidera_setup_init",
                GLIDERA_SETUP_UPDATE: "glidera_setup_update",
                GLIDERA_SETUP_DONE: "glidera_setup_done",
                GLIDERA_OPEN: "glidera_open",
                GLIDERA_BUY: "glidera_buy",
                GLIDERA_BUY_CONFIRM: "glidera_buy_confirm",
                GLIDERA_BUY_ERR: "glidera_buy_error",
                GLIDERA_BUY_DONE: "glidera_buy_done",

                BITONIC_BUY_CONFIRM: "bitonic_buy_confirm",
                BITONIC_OPEN: "bitonic_open",
                BITONIC_GOTO_BITONIC: "bitonic_goto_bitonic"
            }
        };

        var ANALYTICS_META = {};
        Object.keys(EVENTS.BUYBTC).forEach(function(eventKey) {
            var eventVal = EVENTS.BUYBTC[eventKey];
            ANALYTICS_META[eventVal] = { category: "BuyBTC" };
        });

        var trackEvent = function(event) {
            $analytics.eventTrack(event, ANALYTICS_META[event] || { category: 'Events' });

            if (event === EVENTS.LOGIN) {
                if (!window.fbq) {
                    console.error("`fbq` doesn't exist!")
                } else {
                    fbq('track', 'Other');
                }
            } else if (event === EVENTS.REGISTRATION) {
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
            }

        };

        return {
            EVENTS: EVENTS,
            trackEvent: trackEvent
        }
    })
;
