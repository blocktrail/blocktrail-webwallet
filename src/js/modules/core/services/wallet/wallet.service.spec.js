(function () {
    describe("Module: blocktrail.core", function () {
        describe("Services:", function () {
            describe("walletService", function () {
                var service;

                var sdkService = {};
                var walletService = {};

                // Inject the module
                beforeEach(module("blocktrail.core"));

                // Mock dependencies
                beforeEach(module(function($provide) {
                }));

                // Inject the service
                beforeEach(inject(function($injector) {
                    // service = $injector.get("walletsManagerService");
                }));

                it("Should be TRUE", function () {
                    expect(true).toBe(true);
                });
            });
        });
    });
})();
