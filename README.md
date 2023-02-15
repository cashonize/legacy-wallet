## My CashTokens Webwallet

This is the code repository for [My CashTokens Webwallet](https://my-cashtokens-webwallet.netlify.app/), a webwallet with CashTokens support for chipnet. <br>
It is built with the [mainnet-js](https://mainnet.cash/) library. <br>
It started as a minimum viable product but has grown quite a bit. <br>
The project has [proven helpful](https://gist.github.com/mainnet-pat/95df7e844987af8ca4bebbff90f1f625) to iron out issues, bugs and missing features in the mainnet-js library.

### Details

The Webwallet creates a single address chipnet wallet which is persisted in between sessions in indexedDb. <br>
The Webwallet uses m/44'/0'/0'/0/0 as derivation path for seedphrases, this is the mainnet-js default. <br>
The webwallet uses [example_bcmr](https://github.com/mr-zwets/example_bcmr) as a hardcoded metadata registry for tokenmetadata. <br>
The Webwallet uses the new token-aware cashaddress-type which means other software might not recognize it yet. <br>
To get the full wallet object including seedphrase and version 1 cashaddress simply open the console by pressing F12.

### Faucet

To get started with the webwallet and create your own CashTokens on chipnet, get a tBCH balance from the [chipnet faucet](https://tbch.googol.cash/)! <br>


### How it was made

The project was started with the help of [this getting-started blogpost](https://read.cash/@pat/mainnetcash-getting-started-a75b2fc6) for mainnet-js. <br>
Since the way to import it had been changes with version 1.0.0 as can be read [on its github release page](https://github.com/mainnet-cash/mainnet-js/releases/tag/1.0.0). <br>
[Chota](https://jenil.github.io/chota/) has been added along the way for styling.

Netlify automatically publishes the latest version of this repo: [My CashTokens Webwallet](https://my-cashtokens-webwallet.netlify.app/).
