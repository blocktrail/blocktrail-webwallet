angular.module('blocktrail.wallet')
    .factory('trackingService', function(CONFIG, $q, $analytics) {

        var EVENTS = {
            ACTIVATED: 'activated',
            SIGN_UP: "sign_up",
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

                SIMPLEX_OPEN: "simplex_open"
            },
            SWEEP: {
                SWEEP_START: "sweep_start",
                SWEEP_NO_BALANCE: "sweep_no_balance",
                SWEEP_BALANCE: "sweep_balance",
                SWEEP_SUCCESS: "sweep_success",
                SWEEP_FAIL: "sweep_fail"
            }
        };

        var ANALYTICS_META = {};
        Object.keys(EVENTS.BUYBTC).forEach(function(eventKey) {
            var eventVal = EVENTS.BUYBTC[eventKey];
            ANALYTICS_META[eventVal] = { category: "BuyBTC" };
        });

        var getBrowserFingerprint = function() {
            var def = $q.defer();

            new Fingerprint2({excludeFlashFonts: true}).get(function (result, components) {
                if(!result) def.reject();
                def.resolve({
                    "hash": result,
                    "components": components
                });
            });

            return def.promise;
        };

        var trackEvent = function(event) {
            $analytics.eventTrack(event, ANALYTICS_META[event] || { category: 'Events' });

            if (event === EVENTS.LOGIN) {
                if (window.fbq) {
                    // (ab)use "Other" event for logins
                    fbq('track', 'Other');
                }
            } else if (event === EVENTS.ACTIVATED) {
                if (window.fbq) {
                    // (ab)use "Lead" event for activated
                    fbq('track', 'Lead');
                }
            } else if (event === EVENTS.SIGN_UP) {
                if (CONFIG.FBTRACKING_ID) {
                    if (window.fbq) {
                        fbq('track', 'CompleteRegistration');
                    }
                    if (window.fbq) {
                        qp('track', 'Registration');
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
            trackEvent: trackEvent,
            getBrowserFingerprint: getBrowserFingerprint
        }
    })
;
