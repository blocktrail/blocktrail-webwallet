(function () {
    describe("Module: blocktrail.core", function () {
        describe("Services:", function () {
            describe("walletsManagerService", function () {
                var service;
                var $q;
                var $rootScope;
                var sdkServiceStub = jasmine.createSpyObj('sdkServiceStub', ['sdk']);
                var sdkStub = jasmine.createSpyObj('sdkStub', ['getAllWallets']);
                var walletServiceStub = jasmine.createSpyObj('walletServiceStub', ['initWallet']);

                // Inject the moduled
                beforeEach(module("blocktrail.core"));

                // Mock dependencies
                beforeEach(module(function($provide) {
                    $provide.value("sdkService", sdkServiceStub);
                    $provide.value("walletService", walletServiceStub);
                }));

                // Inject the service and helper services
                beforeEach(inject(function($injector) {
                    service = $injector.get("walletsManagerService");
                    $rootScope = $injector.get("$rootScope");
                    $q = $injector.get("$q");
                }));

                it("Should be defined", function () {
                    expect(service).toBeDefined();
                });

                it("Should call the 'sdk' method in the 'sdkService' on the 'fetchWalletsList'", function () {
                    service.fetchWalletsList();

                    expect(sdkServiceStub.sdk).toHaveBeenCalled();
                });

                it("Should call the 'getAllWallets' method in the 'sdkService' on the 'fetchWalletsList'", function(done) {
                    sdkServiceStub.sdk.and.returnValue($q.when(sdkStub));
                    sdkStub.getAllWallets.and.returnValue($q.when({ data: [1] }));

                    service.fetchWalletsList()
                        .then(function() {
                            expect(sdkStub.getAllWallets).toHaveBeenCalledWith({ mywallet: 1, limit: 200 });
                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should return an empty array on the 'getWalletsList'", function() {
                    expect(service.getWalletsList()).toEqual([]);
                });

                it("Should return the array of IDs on the 'getWalletsList'", function(done) {
                    var list = [1, 2, 3];

                    sdkServiceStub.sdk.and.returnValue($q.when(sdkStub));
                    sdkStub.getAllWallets.and.returnValue($q.when({ data: list }));

                    service.fetchWalletsList()
                        .then(function() {
                            expect(service.getWalletsList()).toEqual(list);
                            done();
                        });

                    $rootScope.$apply();
                });

            });
        });
    });
})();
