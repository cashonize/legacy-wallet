document.addEventListener("DOMContentLoaded", async (event) => {
  // make sure rest of code executes after mainnet-js has been imported properly
  Object.assign(globalThis, await __mainnetPromise);

  // change view logic
  let tokenView = false;
  document.querySelector('#view').onclick = () => {
    const pageNav = tokenView ? "WalletView" : "TokenView";
    document.querySelector('#view').innerText = pageNav;
    const displayWalletView = `display: ${tokenView ? "none" : "block"};`;
    const displayTokenView = `display: ${tokenView ? "block" : "none"};`;
    document.querySelector('#walletView').style = displayWalletView;
    document.querySelector('#tokenView').style = displayTokenView;
    tokenView = !tokenView;
  };

  // initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const wallet = await TestNetWallet.named("mywallet");

  const balance = await wallet.getBalance();
  const getTokensResponse = await wallet.getAllTokenBalances();
  let arrayTokens = []
  Object.keys(getTokensResponse).forEach(tokenId => {
    arrayTokens.push({ tokenId, amount: getTokensResponse[tokenId] })
  });

  document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  document.querySelector('#tokenBalance').innerText = `${arrayTokens.length} different tokentypes`;

  wallet.watchBalance((balance) => {
    document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  });
  const tokenAddr = await wallet.getTokenDepositAddress();
  document.querySelector('#depositAddr').innerText = tokenAddr;

  const qr = await wallet.getTokenDepositQr();
  document.querySelector('#depositQr').src = qr.src;

  createListWithTemplate(arrayTokens);

  document.querySelector('#send').addEventListener("click", async () => {
    const addr = document.querySelector('#sendAddr').value;
    const { txId } = await wallet.send([{ cashaddr: addr, value: 1000, unit: "sat" }]);
    alert(`Sent 1000 sats to ${addr}`);
    console.log(`Sent 1000 sats to ${addr} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  });

  document.querySelector('#sendMax').addEventListener("click", async () => {
    const addr = document.querySelector('#sendAddr').value;
    const { txId } = await wallet.sendMax(addr);
    alert(`Sent all funds to ${addr}`);
    console.log(`Sent all funds to ${addr} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  });

  document.querySelector('#createTokens').addEventListener("click", async () => {
    const tokenAmount = document.querySelector('#tokenAmount').value;
    const genesisResponse = await wallet.tokenGenesis({
      amount: tokenAmount,            // fungible token amount
      value: 1000,                    // Satoshi value
    });
    const { tokenId } = genesisResponse.tokenIds[0];
    const { txId } = genesisResponse;

    alert(`Created ${tokenAmount} fungible tokens of category ${tokenId}`);
    console.log(`Created ${tokenAmount} fungible tokens \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  });

  document.querySelector('#createMintingToken').addEventListener("click", async () => {
    const genesisResponse = await wallet.tokenGenesis({
      commitment: "",             // NFT Commitment message
      capability: NFTCapability.minting, // NFT capability
      value: 1000,                    // Satoshi value
    });
    const tokenId = genesisResponse.tokenIds[0];
    const { txId } = genesisResponse;

    alert(`Created minting token for category ${tokenId}`);
    console.log(`Created minting token for category ${tokenId} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  });

  // Display tokenlist
  function createListWithTemplate(tokens) {
    const Placeholder = document.getElementById("Placeholder");
    const ul = document.createElement("ul");
    ul.setAttribute("id", "Placeholder");
    const template = document.getElementById("token-template");

    tokens.forEach(async (token, index) => {
      const tokenCard = document.importNode(template.content, true);
      const tokenType = (token.amount == 0) ? "NFT" : "Fungible Tokens";
      tokenCard.querySelector("#tokenType").textContent = tokenType;
      tokenCard.querySelector("#tokenID").textContent = token.tokenId;
      const textTokenAmount = `Token amount: ${token.amount}`
      // display fungible token amount & fungible token send
      if (token.amount != 0) {
        tokenCard.querySelector("#tokenAmount").textContent = textTokenAmount;
        const tokenSend = tokenCard.querySelector('#tokenSend');
        tokenSend.style = "display:block;"
        const sendSomeButton = tokenSend.querySelector("#sendSomeButton");
        sendSomeButton.onclick = () => {
          const inputAddress = tokenSend.querySelector('#tokenAddress').value;
          sendTokens(inputAddress, 10, token.tokenId)
        }
        const sendAllButton = tokenSend.querySelector("#sendAllButton")
        sendAllButton.onclick = () => {
          const inputAddress = tokenSend.querySelector('#tokenAddress').value;
          sendTokens(inputAddress, token.amount, token.tokenId);
        } 
      } else {
        const nftSend = tokenCard.querySelector('#nftSend');
        nftSend.style = "display:block;"
        const sendNftButton = nftSend.querySelector("#sendNFT");
        sendNftButton.onclick = () => {
          const inputAddress = nftSend.querySelector('#tokenAddress').value;
          sendNft(inputAddress, token.tokenId)
        }
      }
      ul.appendChild(tokenCard);
    });
    Placeholder.replaceWith(ul);
  }

  async function sendTokens(address, amount, tokenId) {
    const { txId } = await wallet.send([
      new TokenSendRequest({
        cashaddr: address,
        amount: amount,
        tokenId: tokenId,
      }),
    ]);
    alert(`Sent ${amount} fungible tokens of category ${tokenId}`);
    console.log(`Sent ${amount} fungible tokens \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  }

  async function sendNft(address, tokenId) {
    const { txId } = await wallet.send([
      new TokenSendRequest({
        cashaddr: address,
        tokenId: tokenId,
        commitment: "",
        capability: NFTCapability.none,
      }),
    ]);
    alert(`Sent NFT of category ${tokenId} to ${address}`);
    console.log(`Sent NFT of category ${tokenId} to ${address} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
  }

})