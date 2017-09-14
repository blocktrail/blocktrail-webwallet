(function () {
    describe("Module: blocktrail.core", function () {
        describe("Services:", function () {
            describe("* walletsManagerService", function () {
                var service;
                var $q;
                var $rootScope;
                var sdkServiceStub = jasmine.createSpyObj("sdkServiceStub", ["getSdkByActiveNetwork"]);
                var walletServiceStub = jasmine.createSpyObj("walletServiceStub", ["initWallet"]);
                var sdkStub = jasmine.createSpyObj("sdkStub", ["getAllWallets"]);
                var sdkStubResponseDataList = [
                    {
                        identifier: "id_1",
                        network: "BTC"
                    }, {
                        identifier: "id_2",
                        network: "BTC"
                    }, {
                        identifier: "id_3",
                        network: "BCC"
                    }, {
                        identifier: "ololo",
                        network: "ololo"
                    }, {
                        identifier: "trololo",
                        network: "trololo"
                    }, {
                        identifier: "id_4",
                        network: "BTC"
                    }, {
                        identifier: "id_5",
                        network: "BCC"
                    }
                ];

                var configStub = {
                    NETWORKS_ENABLED: ['BTC', 'BCC']
                };

                function WalletStub(networkType, identifier, uniqueIdentifier) {
                    var self = this;

                    self._networkType = networkType;
                    self._identifier = identifier;
                    self._uniqueIdentifier = uniqueIdentifier;
                }

                WalletStub.prototype.getReadOnlyWalletData = function () {
                    var self = this;

                    return {
                        networkType: self._networkType,
                        identifier: self._identifier,
                        uniqueIdentifier: self._uniqueIdentifier
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
                    $provide.constant("CONFIG", configStub);
                    $provide.value("sdkService", sdkServiceStub);
                    $provide.value("walletService", walletServiceStub);
                }));

                // Inject the service and helper services and add spy on objects
                beforeEach(inject(function($injector) {
                    service = $injector.get("walletsManagerService");
                    $rootScope = $injector.get("$rootScope");
                    $q = $injector.get("$q");

                    sdkServiceStub.getSdkByActiveNetwork.and.returnValue(sdkStub);

                    sdkStub.getAllWallets.and.returnValue($q.when({ data: sdkStubResponseDataList }));

                    walletServiceStub.initWallet.and.callFake(function(networkType, identifier, uniqueIdentifier) {
                        var wallet = new WalletStub(networkType, identifier, uniqueIdentifier);
                        return $q.when(wallet);
                    });
                }));

                it("Should be defined", function () {
                    expect(service).toBeDefined();
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

                it("Should return an empty array on the 'getWalletsList'", function() {
                    expect(service.getWalletsList()).toEqual([]);
                });

                it("Should return the array of IDs on the 'getWalletsList'", function(done) {
                    var expectationData = [
                        {
                            identifier: "id_1",
                            uniqueIdentifier: "BTC_id_1",
                            network: "BTC"
                        }, {
                            identifier: "id_2",
                            uniqueIdentifier: "BTC_id_2",
                            network: "BTC"
                        }, {
                            identifier: "id_3",
                            uniqueIdentifier: "BCC_id_3",
                            network: "BCC"
                        }, {
                            identifier: "id_4",
                            uniqueIdentifier: "BTC_id_4",
                            network: "BTC"
                        }, {
                            identifier: "id_5",
                            uniqueIdentifier: "BCC_id_5",
                            network: "BCC"
                        }
                    ];

                    service.fetchWalletsList()
                        .then(function() {
                            expect(service.getWalletsList()).toEqual(expectationData);
                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should return null on the 'getActiveWallet', if did not set a wallet", function() {
                    expect(service.getActiveWallet()).toBe(null);
                });

                it("Should trow the error 'Blocktrail core module, wallets manager service. Network type should be defined.' on the 'setActiveWalletByNetworkTypeAndIdentifier' for empty network type property", function(done) {
                    var setActiveWalletByNetworkTypeAndIdentifier = function() {
                        service.setActiveWalletByNetworkTypeAndIdentifier(null, null)
                    };

                    service.fetchWalletsList()
                        .then(function() {
                            expect(setActiveWalletByNetworkTypeAndIdentifier)
                                .toThrowError("Blocktrail core module, wallets manager service. Network type should be defined.");

                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should trow the error 'Blocktrail core module, wallets manager service. Identifier should be defined.' on the 'setActiveWalletByNetworkTypeAndIdentifier' for empty identifier type property", function(done) {
                    var setActiveWalletByNetworkTypeAndIdentifier = function() {
                        service.setActiveWalletByNetworkTypeAndIdentifier("TEST", null)
                    };

                    service.fetchWalletsList()
                        .then(function() {
                            expect(setActiveWalletByNetworkTypeAndIdentifier)
                                .toThrowError("Blocktrail core module, wallets manager service. Identifier should be defined.");

                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should trow the error 'Blocktrail core module, wallets manager service. No wallets for TEST network type.' on the 'setActiveWalletByNetworkTypeAndIdentifier' for empty network type property", function(done) {
                    var setActiveWalletByNetworkTypeAndIdentifier = function() {
                        service.setActiveWalletByNetworkTypeAndIdentifier("TEST", "TEST")
                    };

                    service.fetchWalletsList()
                        .then(function() {
                            expect(setActiveWalletByNetworkTypeAndIdentifier)
                                .toThrowError("Blocktrail core module, wallets manager service. No wallets for TEST network type.");

                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should return the first wallet according to the network type, if wallet identifier is not exist on 'setActiveWalletByNetworkTypeAndIdentifier'", function(done) {
                    var expectationData = new WalletStub("BTC", "id_1", "BTC_id_1");

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByNetworkTypeAndIdentifier("BTC", "TEST")
                                .then(function(wallet) {
                                    expect(wallet).toEqual(expectationData);
                                    done();
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should return the wallet according to the network type and identifier on 'setActiveWalletByNetworkTypeAndIdentifier'", function(done) {
                    var networkType = "BTC";
                    var identifier = "id_2";
                    var uniqueIdentifier = networkType + "_" + identifier;
                    var expectationData = new WalletStub(networkType, identifier, uniqueIdentifier);

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType, identifier)
                                .then(function(wallet) {
                                    expect(wallet).toEqual(expectationData);
                                    done();
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should trow the error 'Blocktrail core module, wallets manager service. Wallet with unique identifier TEST is not exist.' on the 'setActiveWalletByUniqueIdentifier' for not exist wallet's unique identifier", function(done) {
                    var setActiveWalletByUniqueIdentifier = function() {
                        service.setActiveWalletByUniqueIdentifier("TEST")
                    };

                    service.fetchWalletsList()
                        .then(function() {
                            expect(setActiveWalletByUniqueIdentifier)
                                .toThrowError("Blocktrail core module, wallets manager service. Wallet with unique identifier TEST is not exist.");

                            done();
                        });

                    $rootScope.$apply();
                });

                it("Should return the wallet according to the unique identifier on 'setActiveWalletByUniqueIdentifier'", function(done) {
                    var networkType = "BCC";
                    var identifier = "id_3";
                    var uniqueIdentifier = networkType + "_" + identifier;
                    var expectationData = new WalletStub(networkType, identifier, uniqueIdentifier);

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByUniqueIdentifier(uniqueIdentifier)
                                .then(function(wallet) {
                                    expect(wallet).toEqual(expectationData);
                                    done();
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should disable polling for the current active wallet and init new wallet", function(done) {
                    var networkType1 = "BTC";
                    var identifier1 = "id_2";
                    var wallet1;

                    var networkType2 = "BCC";
                    var identifier2 = "id_3";
                    var uniqueIdentifier2 = networkType2 + "_" + identifier2;
                    var wallet2 = new WalletStub(networkType2, identifier2, uniqueIdentifier2);

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType1, identifier1)
                                .then(function(wallet) {
                                    wallet1 = wallet;

                                    spyOn(wallet1, "disablePolling");

                                    service.setActiveWalletByNetworkTypeAndIdentifier(networkType2, identifier2)
                                        .then(function(wallet) {
                                            expect(wallet1.disablePolling).toHaveBeenCalled();
                                            expect(wallet).toEqual(wallet2);
                                            done();
                                        });
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should disable polling for the current active wallet and enable polling for already initialized wallet", function(done) {
                    var networkType1 = "BTC";
                    var identifier1 = "id_2";
                    var wallet1;

                    var networkType2 = "BCC";
                    var identifier2 = "id_3";
                    var wallet2;

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType1, identifier1)
                                .then(function(wallet) {
                                    wallet1 = wallet;

                                    spyOn(wallet1, "enablePolling");

                                    service.setActiveWalletByNetworkTypeAndIdentifier(networkType2, identifier2)
                                        .then(function(wallet) {
                                            wallet2 = wallet;

                                            spyOn(wallet2, "disablePolling");

                                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType1, identifier1)
                                                .then(function(wallet) {
                                                    expect(wallet2.disablePolling).toHaveBeenCalled();
                                                    expect(wallet).toEqual(wallet1);
                                                    done();
                                                });
                                        });
                                });
                        });

                    $rootScope.$apply();
                });

                it("Should not call walletService.initWallet when we switch between already initialized wallets", function(done) {
                    // Reset calls on setActiveWalletByNetworkTypeAndIdentifier
                    walletServiceStub.initWallet.calls.reset();
                    var networkType1 = "BTC";
                    var identifier1 = "id_2";
                    var uniqueIdentifier1 = networkType1 + "_" + identifier1;

                    var networkType2 = "BCC";
                    var identifier2 = "id_3";
                    var uniqueIdentifier2 = networkType2 + "_" + identifier2;

                    service.fetchWalletsList()
                        .then(function() {
                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType1, identifier1)
                                .then(function() {
                                    expect(walletServiceStub.initWallet).toHaveBeenCalledWith(networkType1, identifier1, uniqueIdentifier1);

                                    service.setActiveWalletByNetworkTypeAndIdentifier(networkType2, identifier1)
                                        .then(function() {
                                            expect(walletServiceStub.initWallet).toHaveBeenCalledWith(networkType2, identifier2, uniqueIdentifier2);

                                            service.setActiveWalletByNetworkTypeAndIdentifier(networkType1, identifier1)
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
