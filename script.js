document.addEventListener("DOMContentLoaded", async (event) => {
  // Make sure rest of code executes after mainnet-js has been imported properly
  Object.assign(globalThis, await __mainnetPromise);

  // Test that indexedDB is available
  var db = window.indexedDB.open('test');
  db.onerror = () => alert("Can't use indexedDB, might be because of private window.")

  // Change view logic
  let currentView = 0;
  let otherViews = [1, 2];
  document.querySelector('#view1').onclick = () => showCurrentView(otherViews[0]);
  document.querySelector('#view2').onclick = () => showCurrentView(otherViews[1]);

  function showCurrentView(newView) {
    currentView = newView
    const displayView0 = currentView == 0 ? "block" : "none";
    const displayView1 = currentView == 1 ? "block" : "none";
    const displayView2 = currentView == 2 ? "block" : "none";
    document.querySelector('#WalletView').style = `display: ${displayView0};`;
    document.querySelector('#tokenView').style = `display: ${displayView1};`;
    document.querySelector('#createTokensView').style = `display: ${displayView2};`;
    otherViews = [0, 1, 2].filter(view => view != currentView)
    const nav = ["BchWallet", "MyTokens   ", "CreateTokens"]
    document.querySelector('#view1').innerText = nav[otherViews[0]];
    document.querySelector('#view2').innerText = nav[otherViews[1]];
  }

  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const wallet = await TestNetWallet.named("mywallet");
  console.log(wallet)
  Config.ValidateTokenAddresses = true;

  // Display BCH balance and watch for changes
  const balance = await wallet.getBalance();
  document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  wallet.watchBalance((balance) => {
    document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  });
  // Display token categories, construct arrayTokens and watch for changes
  let arrayTokens = [];
  let tokenCategories = [];
  fetchTokens()
  async function fetchTokens() {
    const getTokensResponse = await wallet.getAllTokenBalances();
    tokenCategories = Object.keys(getTokensResponse);
    for (const tokenId of tokenCategories) {
      const utxos = await wallet.getTokenUtxos(tokenId);
      for (const utxo of utxos) {
        const tokenData = utxo.token;
        arrayTokens.push({ tokenId, amount: getTokensResponse[tokenId], tokenData });
      }
    }
    document.querySelector('#tokenBalance').innerText = `${tokenCategories.length} different tokentypes`;
    createListWithTemplate(arrayTokens);
  }

  wallet.watchAddressTokenTransactions(async(tx) => fetchTokens());

  // Initilize address and display QR code
  const tokenAddr = await wallet.getTokenDepositAddress();
  document.querySelector('#depositAddr').innerText = tokenAddr;
  const qr = await wallet.getTokenDepositQr();
  document.querySelector('#depositQr').src = qr.src;

  // Functionality buttons BchWallet view
  document.querySelector('#send').addEventListener("click", async () => {
    try {
      const amount = document.querySelector('#sendAmount').value;
      const addr = document.querySelector('#sendAddr').value;
      const { txId } = await wallet.send([{ cashaddr: addr, value: amount, unit: "sat" }]);
      alert(`Sent ${amount} sats to ${addr}`);
      console.log(`Sent ${amount} sats to ${addr} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  });

  document.querySelector('#sendMax').addEventListener("click", async () => {
    try {
      const addr = document.querySelector('#sendAddr').value;
      const { txId } = await wallet.sendMax(addr);
      alert(`Sent all funds to ${addr}`);
      console.log(`Sent all funds to ${addr} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  });

  // Functionality buttons CreateTokens view
  document.querySelector('#createTokens').addEventListener("click", async () => {
    try {
      const tokenAmount = document.querySelector('#tokenAmount').value;
      const genesisResponse = await wallet.tokenGenesis({
        amount: tokenAmount,            // fungible token amount
        value: 1000,                    // Satoshi value
      });
      const tokenId = genesisResponse.tokenIds[0];
      const { txId } = genesisResponse;

      alert(`Created ${tokenAmount} fungible tokens of category ${tokenId}`);
      console.log(`Created ${tokenAmount} fungible tokens \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  });

  document.querySelector('#createMintingToken').addEventListener("click", async () => {
    try {
      const genesisResponse = await wallet.tokenGenesis({
        commitment: "",             // NFT Commitment message
        capability: NFTCapability.minting, // NFT capability
        value: 1000,                    // Satoshi value
      });
      const tokenId = genesisResponse.tokenIds[0];
      const { txId } = genesisResponse;

      alert(`Created minting token for category ${tokenId}`);
      console.log(`Created minting token for category ${tokenId} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  });

  // Check if there are tokens in the wallet
  if (!arrayTokens.length) {
    const divNoTokens = document.querySelector('#noTokensFound');;
    divNoTokens.textContent = "Currently there are no tokens in this wallet";
  }
  // Create tokenlist
  function createListWithTemplate(tokens) {
    const Placeholder = document.getElementById("Placeholder");
    const ul = document.createElement("ul");
    ul.setAttribute("id", "Placeholder");
    const template = document.getElementById("token-template");

    tokens.forEach(async (token, index) => {
      const tokenCard = document.importNode(template.content, true);
      const tokenCapability = token.tokenData.capability;
      let tokenType = "Fungible Tokens";
      const nftTypes = {
        minting: "Minting NFT",
        mutable: "Mutable NFT",
        none: "Immutable NFT"
      };
      if (token.amount == 0) tokenType = nftTypes[tokenCapability];
      tokenCard.querySelector("#tokenType").textContent = tokenType;
      const displayId = `${token.tokenId.slice(0, 20)}...${token.tokenId.slice(-10)}`;
      tokenCard.querySelector("#tokenID").textContent = `TokenId: ${displayId}`;
      if (token.tokenData.commitment != "") {
        tokenCard.querySelector("#tokenCommitment").textContent = token.tokenData.commitment;
      }
      const textTokenAmount = `Token amount: ${token.amount}`
      // display fungible token amount & fungible token send
      if (token.amount != 0) {
        tokenCard.querySelector("#tokenAmount").textContent = textTokenAmount;
        const tokenSend = tokenCard.querySelector('#tokenSend');
        tokenSend.style = "display:block;"
        const sendSomeButton = tokenSend.querySelector("#sendSomeButton");
        sendSomeButton.onclick = () => {
          const amount = tokenSend.querySelector('#sendTokenAmount').value;
          const inputAddress = tokenSend.querySelector('#tokenAddress').value;
          sendTokens(inputAddress, amount, token.tokenId)
        }
        const sendAllButton = tokenSend.querySelector("#sendAllButton")
        sendAllButton.onclick = () => {
          const inputAddress = tokenSend.querySelector('#tokenAddress').value;
          sendTokens(inputAddress, token.amount, token.tokenId);
        }
      } else {
        const nftSend = tokenCard.querySelector('#nftSend');
        nftSend.style = "display:block;";
        const sendNftButton = nftSend.querySelector("#sendNFT");
        sendNftButton.onclick = () => {
          const inputAddress = nftSend.querySelector('#tokenAddress').value;
          sendNft(inputAddress, token.tokenId)
        }
        const nftMint = tokenCard.querySelector('#nftMint');
        if (tokenCapability == "minting") nftMint.style = "display:block;"
        const mintNftButton = nftMint.querySelector("#mintNFT");
        mintNftButton.onclick = () => {
          const tokenCommitment = nftMint.querySelector('#commitmentInput').value;
          mintNft(token.tokenId, tokenCommitment)
        }
      }
      ul.appendChild(tokenCard);
    });
    Placeholder.replaceWith(ul);
  }

  // Functionality buttons MyTokens view
  async function sendTokens(address, amount, tokenId) {
    try {
      const { txId } = await wallet.send([
        new TokenSendRequest({
          cashaddr: address,
          amount: amount,
          tokenId: tokenId,
        }),
      ]);
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Sent ${amount} fungible tokens of category ${displayId}`);
      console.log(`Sent ${amount} fungible tokens of category ${displayId} to ${address} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  }

  async function sendNft(address, tokenId) {
    try {
      const { txId } = await wallet.send([
        new TokenSendRequest({
          cashaddr: address,
          tokenId: tokenId,
          commitment: "",
          capability: NFTCapability.none,
        }),
      ]);
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Sent NFT of category ${displayId} to ${address}`);
      console.log(`Sent NFT of category ${displayId} to ${address} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  }

  async function mintNft(tokenId, tokenCommitment) {
    try {
      const { txId } = await wallet.tokenMint(
        tokenId,
        [
          new TokenMintRequest({
            commitment: tokenCommitment,
            capability: NFTCapability.none,
            value: 1000,
          })
        ],
      );
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Minted immutable NFT of category ${displayId}`);
      console.log(`Minted immutable NFT of category ${displayId} \nhttps://chipnet.imaginary.cash/tx/${txId}`);
    } catch (error) { alert(error) }
  }

})