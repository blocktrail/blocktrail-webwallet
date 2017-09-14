(function () {
    describe("Module: blocktrail.core", function () {
        describe("Services:", function () {
            describe("* walletService", function () {
                // Inject the module
                beforeEach(module("blocktrail.core"));

                // Mock dependencies
                beforeEach(module(function($provide) {
                }));

                // Inject the service
                beforeEach(inject(function($injector) {
                    // service = $injector.get("walletsManagerService");
                }));
            });
        });
    });
})();
