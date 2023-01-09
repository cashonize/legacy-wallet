## A MVP CashTokens Webwallet

This is a proof-of-concept webwallet using Mainnet-js for CashToken support.

The Webwallet creates a persistent chipnet wallet (saved in IndexDb) which has a CashToken supporting address, also displayed as QR code.
The Webwallet has a Wallet View and a Token view.
In the Wallet view you can send BCH, create fungible tokens and create a minting NFT.
In the Token View you can see your different tokens and can send them to somewhere else.

To fund the wallet you can copy the cashaddress from the console (by hitting F12) and navigating to the [chipnet faucet](https://tbch.googol.cash/).

The Webwallet was started with the help of [this getting-started blogpost](https://read.cash/@pat/mainnetcash-getting-started-a75b2fc6).
However the imports with the script tag changed with version 1.0.0 as can be read [on its github release page](https://github.com/mainnet-cash/mainnet-js/releases/tag/1.0.0).

Here is the live version of the project, deployed with Netlify: [MVP CashTokens Webwallet](https://mvp-cashtokens-webwallet.netlify.app/).

Made with [Mainnet.cash](https://mainnet.cash/).