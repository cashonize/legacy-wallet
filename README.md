# My CashTokens Webwallet

My CashTokens WebWallet for Bitcoin Cash - [cashtokens-wallet.app](https://cashtokens-wallet.app)<br>
:exclamation: There are scammers impersonating this wallet so carefully check the domain!

This is the code repository for [My CashTokens Webwallet](https://my-cashtokens-webwallet.netlify.app/), a webwallet with CashTokens support.
The wallet is built with the [mainnet-js](https://mainnet.cash/) library.
The project was started in early January as a minimum viable product but has grown into a full-fledged webwallet.
The webwallet can now supports both BCH mainnet and chipnet where all the testing for the CashTokens upgrade took place.
The project has [proven helpful](https://gist.github.com/mainnet-pat/95df7e844987af8ca4bebbff90f1f625) to iron out issues, bugs and missing features in the mainnet-js library.

#### Details

The Webwallet creates a single address wallet which is persisted in between sessions in indexedDb.
The Webwallet uses the standard derivation path (m/44'/145'/0'/0/0) to create new wallet but also supports importing 
from m/44'/0'/0'/0/0.
You can back-up the wallet by getting the seed phrase from the settings view.
The webwallet uses [OpenTokenRegistry](https://otr.cash/.well-known/bitcoin-cash-metadata-registry.json) & [example_bcmr](https://github.com/mr-zwets/example_bcmr) as hardcoded metadata registries for tokenmetadata.
After making a transaction a link to a blockexplorer is logged in the console (press F12 to access).
The wallet was first hosted on a netlify subdomain (https://my-cashtokens-webwallet.netlify.app/) before the current domain (cashtokens-wallet.app) was acquired, the old url still works.


#### Disclaimer

The wallet can now connect to the main BCH network so can be used with real money for the first time.
Users should be very cautious as this is brand new software so it should not be used for any significant amounts of money.
I as the developer did my best to test the wallet but I make no guarantees to the full security of the wallet.
Lastly, always back up your seedphrase!

#### Faucet

To start experimenting with the webwallet and create your own CashTokens without any Bitcoin Cash, You can connect the wallet to chipnet & get a tBCH balance from the [chipnet faucet](https://tbch.googol.cash/)!

#### Planned features

You can find the planned features on the issues page on GitHub.
Feel free to open a new issue to report bugs or suggest improvements!
Currently not planning on adding transaction history to the webwallet.

#### How it was made

The project was started with the help of [this getting-started blogpost](https://read.cash/@pat/mainnetcash-getting-started-a75b2fc6) for mainnet-js.
Since the way to import it had been changes with version 1.0.0 as can be read [on its github release page](https://github.com/mainnet-cash/mainnet-js/releases/tag/1.0.0).
[Chota](https://jenil.github.io/chota/) as a styling library and [Switchery](https://github.com/abpetkov/switchery) for toggle switches.
For icons the webwallet uses [icongr.am](https://icongr.am).
[blockies](https://github.com/download13/blockies) is used to generate blocky identicons for tokens.
The [chaingraph demo instance](https://chipnet.chaingraph.cash) is used to query on-chain tokeen info about gensis supply and minting UTXOs.
Finally, [bitjson/qr-code](https://github.com/bitjson/qr-code) is used to generate the qr-codes.

Netlify automatically publishes the latest version of this repo: [My CashTokens Webwallet](https://github.com/mr-zwets/my-cashtokens-webwallet).

#### Special thanks to
bitcoincashautist, pat from mainnet-js, damascene & bitjson
