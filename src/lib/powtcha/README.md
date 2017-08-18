PoWtcha
=======
sha256 Proof of Work Captcha

Usage
-----
```js
var salt = Buffer.from('fe23fe23fe23fe23fe23', 'hex');

PoWtcha.work(salt, PoWtcha.TARGET.EASY).then(function(res) {
    var nonce = res[0], hash = res[1];
    assert.equal(nonce, 5184);
    assert.equal(hash.toString('hex'), '000ce8507df7e6f3d173a450d74afa007b4eba74c95a57f60b8eb8e46b0f5899');
});
```

Development / Contributing
--------------------------
You should have `mocha`, `istanbul` and `grunt-cli` installed globally, if not run `npm install -g mocha instanbul grunt-cli`.  
Also recommended to have `phantomjs >= 1.9.8` on `$PATH` to speed up the `asmcrypto.js` build; https//github.com/Medium/phantomjs/releases/download/v1.9.19/phantomjs-1.9.8-linux-x86_64.tar.bz2

Unit Tests are created with Mocha and can be ran with `npm test` (or `mocha`)

We also run jshint and jscs, these are automatically ran by [travis-ci](https://travis-ci.org/btccom/powtcha-js) for every commit and pull request.

```bash
jshint main.js lib/ test/ && jscs main.js lib/ test/
```

or simply `npm run-script lint`

Uglify
------
If you're planning to uglify/minify the javascript yourself, make sure to exclude the following variable names from being mangled:  
`['Buffer', 'sha256_asm', 'asm']`

License
-------
PoWtcha is released under the terms of the MIT license. See LICENCE.md for more information or see http://opensource.org/licenses/MIT.
