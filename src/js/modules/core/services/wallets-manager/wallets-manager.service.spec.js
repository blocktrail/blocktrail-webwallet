(function () {
    describe("Module: blocktrail.core", function () {
        describe("Services:", function () {
            describe("* walletsManagerService", function () {
                var service;
                var $q;
                var $rootScope;
                var sdkServiceStub = jasmine.createSpyObj('sdkServiceStub', ['sdk']);
                var sdkStub = jasmine.createSpyObj('sdkStub', ['getAllWallets']);
                var walletServiceStub = jasmine.createSpyObj('walletServiceStub', ['initWallet']);
                var list = [{
                    identifier: 'id_1'
                }, {
                    identifier: 'id_2'
                }, {
                    identifier: 'id_3'
                }];

                function WalletStub(id) {
                    var self = this;

                    self._identifier = id;
                }

                WalletStub.prototype.getReadOnlyWalletData = function () {
                    var self = this;

                    return {
                        identifier: self._identifier
                    }
                };

                WalletStub.prototype.disablePolling = function () {
                };

                WalletStub.prototype.enablePolling = function () {
                };



                // Inject the module
                beforeEach(module("blocktrail.core"));

                // Mock dependencies
                beforeEach(module(function($provide) {
                    $provide.value("sdkService", sdkServiceStub);
                    $provide.value("walletService", walletServiceStub);
                }));

                // Inject the service and helper services and add spy on objects
                beforeEach(inject(function($injector) {
                    service = $injector.get("walletsManagerService");
                    $rootScope = $injector.get("$rootScope");
                    $q = $injector.get("$q");

                    sdkServiceStub.sdk.and.returnValue($q.when(sdkStub));
                    sdkStub.getAllWallets.and.returnValue($q.when({ data: list }));
                    walletServiceStub.initWallet.and.callFake(function(id) {
                        var wallet = new WalletStub(id);
                        return $q.when(wallet);
                    });
                }));

                it("Should be defined", function () {
                    expect(service).toBeDefined();
                });

                it("Should call the 'sdk' method in the 'sdkService' on the 'fetchWalletsList'", function () {
                    service.fetchWalletsList();

                    expect(sdkServiceStub.sdk).toHaveBeenCalled();
                });

                it("Should call the 'getAllWallets' method in the 'sdkService' on the 'fetchWalletsList'", function(done) {
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
                    service.fetchWalletsList()
                        .then(function() {
                            expect(service.getWalletsList()).toEqual(list);
                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should return null on the 'getActiveWallet', if did not set a wallet", function() {
                    expect(service.getActiveWallet()).toBe(null);
                });

                it("Should return null on the 'setActiveWalletById', if wallet's list is empty", function(done) {
                    sdkStub.getAllWallets.and.returnValue($q.when({ data: [] }));

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(null)
                                .then(function(wallet) {
                                    expect(wallet).toBe(null);
                                    done();
                                });
                        });

                    $rootScope.$apply();

                    expect(service.getActiveWallet()).toBe(null);
                });

                it("Should return wallet with first id from the list on the 'setActiveWalletById', if wallet id is null", function(done) {
                    var expectedWallet = new WalletStub('id_1');

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(null)
                                .then(function(wallet) {
                                    expect(wallet).toEqual(expectedWallet);
                                    done();
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should return wallet with first id from the list on the 'setActiveWalletById', if wallet id is not in the list and any wallet wasn't setup before", function(done) {
                    var expectedWallet = new WalletStub('id_1');

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(666)
                                .then(function(wallet) {
                                    expect(wallet).toEqual(expectedWallet);
                                    done();
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should return previously settled wallet on the 'setActiveWalletById', if wallet id is not in the list", function(done) {
                    var setupWalletId = 'id_2';
                    var expectedWallet = new WalletStub(setupWalletId);

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(setupWalletId)
                                .then(function() {
                                    service.setActiveWalletById(666)
                                        .then(function(wallet) {
                                            expect(wallet).toEqual(expectedWallet);
                                            done();
                                        });
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should disable polling for current active wallet and init new wallet", function(done) {
                    var setupWalletId1 = 'id_2';
                    var wallet1;

                    var setupWalletId2 = 'id_1';
                    var expectedWallet2 = new WalletStub(setupWalletId2);

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(setupWalletId1)
                                .then(function(wallet) {
                                    wallet1 = wallet;
                                    spyOn(wallet1, "disablePolling");

                                    service.setActiveWalletById(setupWalletId2)
                                        .then(function(wallet) {
                                            expect(wallet1.disablePolling).toHaveBeenCalled();
                                            expect(wallet).toEqual(expectedWallet2);
                                            done();
                                        });
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should disable polling for current active wallet and enable polling for already initialized wallet", function(done) {
                    var setupWalletId1 = 'id_2';
                    var wallet1;

                    var setupWalletId2 = 'id_1';
                    var wallet2;

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(setupWalletId1)
                                .then(function(wallet) {
                                    wallet1 = wallet;
                                    spyOn(wallet1, "enablePolling");

                                    service.setActiveWalletById(setupWalletId2)
                                        .then(function(wallet) {
                                            wallet2 = wallet;
                                            spyOn(wallet2, "disablePolling");

                                            service.setActiveWalletById(setupWalletId1)
                                                .then(function(wallet) {
                                                    expect(wallet2.disablePolling).toHaveBeenCalled();
                                                    expect(wallet1.enablePolling).toHaveBeenCalled();
                                                    expect(wallet).toEqual(wallet1);
                                                    done();
                                                });
                                        });
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should not call walletService.initWallet when we switch between already initialized wallets", function(done) {
                    // Reset calls on initWallet
                    walletServiceStub.initWallet.calls.reset();
                    var setupWalletId1 = 'id_1';
                    var setupWalletId2 = 'id_2';

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletById(setupWalletId1)
                                .then(function() {
                                    expect(walletServiceStub.initWallet).toHaveBeenCalledWith(setupWalletId1);

                                    service.setActiveWalletById(setupWalletId2)
                                        .then(function() {
                                            expect(walletServiceStub.initWallet).toHaveBeenCalledWith(setupWalletId2);

                                            service.setActiveWalletById(setupWalletId1)
                                                .then(function() {
                                                    expect(walletServiceStub.initWallet.calls.count()).toEqual(2);
                                                    done();
                                                });
                                        });
                                });
                        });

                    $rootScope.$apply();
                });


            });
        });
    });
})();
