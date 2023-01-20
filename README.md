## My CashTokens Webwallet

This is the code repository for [My CashTokens Webwallet](https://my-cashtokens-webwallet.netlify.app/), a webwallet with CashTokens support for chipnet. <br>
It is built with the [mainnet-js](https://mainnet.cash/) library. <br>
It started as a minimum viable product but has grown quite a bit.

### Details

The Webwallet creates a single address chipnet wallet which is persisted in between sessions in indexedDb. <br>
The Webwallet uses the new token-aware cashaddress-type which means other software might not recognize it yet.

### Faucet

To fund the wallet you can copy the regular (non-token-aware) cashaddress from the console (by hitting F12) and navigating to the [chipnet faucet](https://tbch.googol.cash/). <br>
This is because the faucet does not yet support token-aware cashaddresses.

### How it was made

The project was started with the help of [this getting-started blogpost](https://read.cash/@pat/mainnetcash-getting-started-a75b2fc6) for mainnet-js. <br>
Since the way to import it had been changes with version 1.0.0 as can be read [on its github release page](https://github.com/mainnet-cash/mainnet-js/releases/tag/1.0.0). <br>
[Chota](https://jenil.github.io/chota/) has been added along the way for styling.

Netlify automatically publishes the latest version of this repo: [My CashTokens Webwallet](https://my-cashtokens-webwallet.netlify.app/).
