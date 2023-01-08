A MVP CashTokens Webwallet

This is a proof-of-concept experiment with the Mainnet-js library's CashToken support.

The Webwallet creates a persistent chipnet wallet (saved in IndexDb) which has a CashToken supporting address, also displayed as QR code.
The Webwallet has the ability to send BCH, create fungible tokens and create a minting NFT.
Listens to incoming BCH transactions but currently needs to be refreshed for the tokenbalances.

The Wallet was started with the help of [this getting-started blogpost](https://read.cash/@pat/mainnetcash-getting-started-a75b2fc6).
However the imports with the script tag changed with version 1.0.0 as can be read [on its github release page](https://github.com/mainnet-cash/mainnet-js/releases/tag/1.0.0).

Here is the live version of the project, deployed with Netlify: [MVP CashTokens Webwallet](https://mvp-cashtokens-webwallet.netlify.app/).

Made with [Mainnet.cash](https://mainnet.cash/).