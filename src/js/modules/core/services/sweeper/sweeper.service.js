(function () {
    "use strict";

    angular.module('blocktrail.wallet')
        .factory('sweeperService', SweeperService);

    function SweeperService($q, bitcoinJS, bip39, BlocktrailBitcoinService, sdkService, launchService) {
        var bitcoinDataClient = null;
        var debugInfo = [];

        function batchDeriveAddressesAndPrivKeys(parentNode, startIndex, batchSize) {
            var currentNode = null;
            var currentAddress = null;
            var batchArray = {};

            for (var i = startIndex; i <= batchSize + startIndex; i++) {
                currentNode = parentNode.derive(i);
                currentAddress = currentNode.getAddress();
                var currentPrivKey = currentNode.keyPair;

                batchArray[currentAddress] = {
                    priv_key: currentPrivKey,
                    derive_idx: i
                }
            }
            return batchArray;
        }

        function batchDiscoverUTXOs(parent, batchLoopCount, batchSize) {
            var parentPath = parent[0];
            var parentNode = parent[1];
            var batchDataObject = batchDeriveAddressesAndPrivKeys(parentNode, batchLoopCount * batchSize, batchSize);
            var addresses = Object.keys(batchDataObject);

             var batchDebugInfo = [['batch', parentPath, parentNode.neutered().toBase58(), batchLoopCount, batchSize]];

            debugInfo.push(batchDebugInfo);

            return bitcoinDataClient.batchAddressHasTransactions(addresses).then(function (success) {
                batchDebugInfo.push(['addresses', addresses, success]);
                if (!success) {
                    return false;
                }
                return bitcoinDataClient.getBatchUnspentOutputs(addresses);
            }).then(function (result) {
                batchDebugInfo.push(['utxos', JSON.parse(JSON.stringify(result))]); // JSON to make a clean copy
                var addresses = Object.keys(result);
                // Add important data (privkey and derive index)
                angular.forEach(addresses, function(address) {
                    result[address].priv_key = batchDataObject[address].priv_key;
                    result[address].derive_idx = batchDataObject[address].derive_idx;
                });
                return result;
            });
        }

        function discover(parent, batchSize, loopCount, utxos) {
            loopCount = loopCount || 0;
            utxos = utxos || {};

            return batchDiscoverUTXOs(parent, loopCount, batchSize).then(function (result) {
                if (!result) {
                    return utxos;
                }

                angular.extend(utxos, result);
                return discover(parent, batchSize, loopCount + 1, utxos);
            })
        }

        function signAndSweep(resultUTXOs, options) {

            var addresses = Object.keys(resultUTXOs);

            // Create raw transaction
            var inputs = [];

            var hashType = bitcoinJS.Transaction.SIGHASH_ALL;
            // If Bitcoin Cash sweep
            if (options.network.toLowerCase() === 'bcc') {
                hashType |= bitcoinJS.Transaction.SIGHASH_BITCOINCASHBIP143;
            }

            // For each address (key) of res object, the value is an array of UTXO objects
            for (var i = 0; i < addresses.length; i++) {
                var address = addresses[i];

                angular.forEach(resultUTXOs[address], function(utxo) {
                    inputs.push({
                        txid: utxo['hash'],
                        vout: utxo['index'],
                        scriptPubKey: utxo['script_hex'],
                        value: utxo['value'],
                        address: address
                    });
                });
            }

            return bitcoinDataClient.estimateFee().then(function (feePerKB) {

                var txAfter = 600;

                var chunks = [];
                var index = 0;
                var length = inputs.length;

                while (index < length) {
                    chunks.push(inputs.slice(index, index += txAfter + 1));
                    // index += txAfter;
                }

                return chunks.map(function (chunkInputs) {
                    var rawTransaction = new bitcoinJS.TransactionBuilder();

                    var totalValue = 0;
                    angular.forEach(chunkInputs, function (input, index) {
                        totalValue += parseInt(input['value']);
                        rawTransaction.addInput(input['txid'], input['vout']);
                    });

                    if (totalValue <= blocktrailSDK.DUST) {
                        return false;
                    }

                    rawTransaction.addOutput(options.recipient, totalValue);
                    console.log("FeePerKb: ", feePerKB);

                    var fee = blocktrailSDK.Wallet.estimateIncompleteTxFee(rawTransaction.tx, feePerKB);
                    rawTransaction.tx.outs[0].value -= fee;

                    if (rawTransaction.tx.outs[0].value <= blocktrailSDK.DUST) {
                        return false;
                    }

                    // If Bitcoin Cash sweep
                    if (options.network.toLowerCase() === 'bcc') {
                        rawTransaction.enableBitcoinCash(true);
                    }

                    angular.forEach(chunkInputs, function (input, index) {
                        var currentPrivKey = resultUTXOs[input.address].priv_key;
                        rawTransaction.sign(index, currentPrivKey, null, hashType, input.value);
                    });

                    return {
                        rawTx: rawTransaction.build().toHex(),
                        feePaid: fee,
                        inputCount: chunkInputs.length,
                        totalValue: totalValue
                    }
                });
            });
        }

        function hdDiscover(root, batchSize, accountBatchSize, testnet, accountIdx, UTXOs) {
            testnet = testnet ? 1 : 0;
            accountIdx = accountIdx || 0;
            UTXOs = UTXOs || {};

            var searchPaths = [];
            for (var i = accountIdx ; i < accountIdx + accountBatchSize; i++) {
                var path = "m/44\'/" + testnet + "\'/" + i + "\'";
                // main address chain
                searchPaths.push([path + "/0", root.derivePath(path + "/0")]);
                // change address chain
                searchPaths.push([path + "/1", root.derivePath(path + "/1")]);
            }

            return $q.all(searchPaths.map(function (node) {
                return discover(node, batchSize)
            }))
                .then(function (resultLists) {
                    var done = true;
                    angular.forEach(resultLists, function (result) {
                        if(Object.keys(result).length > 0) {
                            done = false;
                        }
                        angular.extend(UTXOs, result);
                    });

                    if (done) {
                        return UTXOs;
                    }

                    return hdDiscover(root, batchSize, accountBatchSize, testnet, accountIdx + accountBatchSize, UTXOs);
                });
        }

        function getBitcoinDataClient(options) {
            return launchService.getAccountInfo()
                .then(function(accountInfo) {
                    bitcoinDataClient = new BlocktrailBitcoinService({
                        apiKey: accountInfo.api_key,
                        apiSecret: accountInfo.api_secret,
                        network: options.network,
                        testnet: options.testnet
                    });

                    return bitcoinDataClient;
                });
        }

        function genericHdNodeDiscover(root, options) {
            return getBitcoinDataClient(options)
                .then(function () {
                    // reset debugInfo
                    debugInfo = [];

                    return hdDiscover(root, options.batchSize, options.accountBatchSize, options.testnet)
                });
        }

        function bip44Sweep(mnemonic, options) {
            if (!bip39.validateMnemonic(mnemonic)) {
                return Promise.reject("Invalid Mnemonic.");
            }

            var seed = bip39.mnemonicToSeed(mnemonic);

            var entropy = new blocktrailSDK.Buffer(seed, 'hex');
            var root = bitcoinJS.HDNode.fromSeedBuffer(entropy);

            return genericHdNodeDiscover(root, options).then(function (resultUTXOs) {
                return signAndSweep(resultUTXOs, options);
            }, function () {
                console.log("Discovery failed")
            })
        }

        function wifSweep(WIFs, options) {
            return $q.when()
                .then(function() {
                    // reset debugInfo
                    debugInfo = [];

                    var keys = WIFs.map(function(WIF) {
                        return bitcoinJS.ECPair.fromWIF(WIF);
                    });

                    var keysByAddress = {};
                    angular.forEach(keys, function(key) {
                        var mirrorKey = new bitcoinJS.ECPair(key.d, null, {network: key.network, compressed: !key.compressed});
                        debugInfo.push(['WIF', key.getAddress(), mirrorKey.getAddress()]);

                        keysByAddress[key.getAddress()] = key;
                        keysByAddress[mirrorKey.getAddress()] = mirrorKey;
                    });

                    var addresses = Object.keys(keysByAddress);

                    return getBitcoinDataClient(options).then(function() {
                        return bitcoinDataClient.batchAddressHasTransactions(addresses).then(function(success) {
                            debugInfo.push(['batchAddressHasTransactions', success]);

                            if (!success) {
                                return false;
                            }
                            return bitcoinDataClient.getBatchUnspentOutputs(addresses);
                        }).then(function(result) {
                            debugInfo.push(['getBatchUnspentOutputs', JSON.parse(JSON.stringify(result))]); // JSON to make a clean copy

                            var addresses = Object.keys(result);
                            angular.forEach(addresses, function(address) {
                                result[address].priv_key = keysByAddress[address];
                            });

                            return result;
                        })
                        .then(function(resultUTXOs) {
                            return signAndSweep(resultUTXOs, options);
                        }, function() {
                            console.log("Discovery failed")
                        });
                    });
                });
        }

        function submitDebugInfo() {
            var sdk = sdkService.getSdkByActiveNetwork();
            return sdk.client.post("/mywallet/sweeper/submit-debug-info", null, debugInfo);
        }

        return {
            bip44Sweep: bip44Sweep,
            wifSweep: wifSweep,
            submitDebugInfo: submitDebugInfo
        };
    }

})();
