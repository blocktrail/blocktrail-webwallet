# Blocktrail Web Wallet
Take back control of your Bitcoin!  
BlockTrail's Bitcoin wallet features unparalleled security through MultiSignature technology, keeping you in full control of your coins at all time. 
Transactions are signed in your browser so we never see your private keys.

With our HD wallets you can create an unlimited number of addresses to help protect your privacy without the need for multiple private key backups. 
Our system will also generate new addresses for change and fund requests automatically.

Access your wallet anywhere, anytime; use the mobile app when you're on the go, or log in to the web-interface when at home or in the office.

- 2-of-3 Multisig technology so you always remain in control of your coins
- HD wallet technology allowing you to create an unlimited number of addresses
- Send and Receive bitcoin easily
- Live update for new transactions and your balance
- View your full transaction history with the price at the time of the transaction
- Personalise your account so your friends can quickly identify you
- QR code scanning with bitcoin URI support
- Transactions signed locally in your browser
- Backup document in case the worst happens
- Local currency display using live price updates

## Mobile Wallet
For the Mobile Wallet see; https://github.com/blocktrail/blocktrail-wallet

## Install
```
npm install -g gulp
npm install
git submodule update --init --recursive # for translations package
cp appconfig.example.json appconfig.json
gulp
```

## Run
```
npm install -g serve # one time
cd www
serve # now you can visit http://localhost:3000
```

## Translations
Translations for both Web and Mobile Wallet are kept in: https://github.com/blocktrail/blocktrail-wallet-translations  
And then submoduled into the projects.  

Keep this in mind when adding / updating translations, don't forget to commit them to the translations repo.  

It's okay to do PRs without bumping the translations submodule, we'll handle that before doing releases!

## Fontello
We use fontello for icons, if you want to add new icons you can run the `gulp fontello` task 
and copy the fontello URL that is printed as part of the output, then visit that URL and add any new icons.  
Afterwards download the config.json from the site and overwrite the `src/fontello/config.json`, 
then run `gulp fontello` again and it will update the contents of `src/fontello`.

## Statics & CDN
Statics are compiled with `gulp` and with default config into `www/dev`, 
if `STATICSDIR` in `appconfig.json` is set to `NULL` however it will use `www/${branch}-${commit}` to keep statics versioned.

with `./scripts/upload_to_oss.sh` statics are pushed to the CDN backend.

## License
The Blocktrail Wallet source code is released under the GNU Affero General Public License.  
The Blocktrail Logo and any other images / graphics are not part of this.  
See [LICENSE.md](LICENSE.md).
