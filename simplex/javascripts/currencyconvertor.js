function simplerPromise(url, data) {
    return $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: url,
        data: JSON.stringify(data),
        processData: false
    });
}

var app = new Vue({
    el: '#app',
    data: {
        btc_amount: 0,
        fiat_amount:0,
        btcaddress: '',
        config: config,
        address_error: 'koko',
        address_validation_status: false,
        recaptcha_validation_status: false,
        fiat_currency: 'USD',
        supported_currency: [
            { name: 'USD', ratio: 700 },
            { name: 'EUR', ratio: 638 }
        ]
    },
    created: function () {
        this.isPaymentSubmitting = false;
        this.simpler_payment_url = '/simpler/payment';

        this.fiat_currency = this.config.lastQuote.fiat_money.currency;
        this.btc_amount = this.config.lastQuote.digital_money.amount;
        this.fiat_amount = this.config.lastQuote.fiat_money.amount;
    },
    computed: {
        showAddressError: function () {
                return this.address_validation_status
            },
        getAddressError: function () {
            return this.address_error;
            },
        showRecaptchaError: function () {
            return this.recaptcha_validation_status
            },
        selectedFiatCurrency: function () {
            return this.fiat_currency
        }
        },
    methods: {
        hideErrors: function () {
            this.address_validation_status = false;
            this.recaptcha_validation_status = false;
        },
        sendPaymentRequest: function (event) {
            if(event){
                event.preventDefault();
            }

            if (!this.validatePaymentRequest() || this.isPaymentSubmitting) {
                return;
            }
            this.isPaymentSubmitting = true;

            recaptchaResponse = this.$refs["rehead"].querySelector('#g-recaptcha-response');

            var requestData = {
                walletaddress: this.btc_amount,
                last_quote_response: this.config.lastQuote,
                'g-recaptcha-response': recaptchaResponse.value,
                _csrf: this.config.csrfToken
            };

            var self = this;
            simplerPromise(this.simpler_payment_url, requestData)
                .done(function(formHtml) {
                    self.$refs["formplaceholder"].innerHTML=formHtml;
                    self.$refs["formplaceholder"].querySelector('#payment_form').submit();
                    self.isPaymentSubmitting = false;
                })
                .fail(function() {
                    grecaptcha.reset();
                    self.isPaymentSubmitting = false;
                });
        },
        validatePaymentRequest: function() {
            this.hideErrors();

            var validAddr = check_btc_address_base3(this.btcaddress.trim());
            //var validAddr = false;
            if (!validAddr) {
                this.address_error = "Please provide a valid Bitcoin address";
                this.address_validation_status = true;
                return false;
            }

            if (this.recaptcha_site_key !== null){
                recaptchaResponse = this.$refs["rehead"].querySelector('#g-recaptcha-response');
                console.log(recaptchaResponse);
                if(recaptchaResponse == null || recaptchaResponse.value == null ||
                    recaptchaResponse.value.length == 0)
                {
                    this.recaptcha_validation_status = true;
                    return false;
                }
            }

            return true;
        },
        onBTCAmountChange: function (event){
            this.btc_amount = this.btc_amount.toFixed(8);
            this.fiat_amount = (this.btc_amount * this.config.lastQuote.base_rate);
        },
        onAmountChange:function (event){
            this.btc_amount = (this.fiat_amount * 1.0 / this.config.lastQuote.base_rate).toFixed(8);
        },
        changeFiat:function (currency,ratio){
            //disable the selected option & update the button display
            this.fiat_currency = currency;
            //set the ratio value
            this.config.lastQuote.base_rate = ratio;
            //recalculate the value
            this.onAmountChange(null);
        }
    }
});