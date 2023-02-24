const explorerUrl = "https://chipnet.chaingraph.cash";

const newWalletView = document.querySelector('#newWalletView');
const footer = document.querySelector('.footer');
const seedphrase = document.getElementById("seedphrase");
// Logic dark mode
let darkMode = false;
const readDarkMode = localStorage.getItem("darkMode");
window.toggleDarkmode = function toggleDarkmode() {
  darkMode = !darkMode;
  document.body.classList= darkMode? "dark" : "";
  const icons = document.querySelectorAll('.icon');
  if(darkMode) icons.forEach(icon => icon.classList.add("dark"));
  else icons.forEach(icon => icon.classList.remove("dark"));
  localStorage.setItem("darkMode", `${darkMode}`);
  document.querySelector('#darkmode').checked = darkMode;
}
if (readDarkMode === "true") window.toggleDarkmode();
if (readDarkMode == undefined && window.matchMedia &&
window.matchMedia('(prefers-color-scheme: dark)').matches) {
    window.toggleDarkmode();
}
// Logic default unit
const readUnit = localStorage.getItem("unit");
if(readUnit) document.querySelector('#selectUnit').value = readUnit;
let unit = readUnit || 'tBCH';

document.addEventListener("DOMContentLoaded", async (event) => {
  // Make sure rest of code executes after mainnet-js has been imported properly
  Object.assign(globalThis, await __mainnetPromise);

  // Test that indexedDB is available
  var db = window.indexedDB.open('test');
  db.onerror = () => {
    footer.classList.remove("hide");
    newWalletView.classList.remove("hide");
    setTimeout(() => alert("Can't create a persistent wallet because indexedDb is unavailable, might be because of private window."), 100);
  }

  const walletExists = await TestNetWallet.namedExists('mywallet');
  footer.classList.remove("hide");
  if(!walletExists) newWalletView.classList.remove("hide");
  else{loadWalletInfo()};
})

window.createNewWallet = async function createNewWallet() {
  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  await TestNetWallet.named("mywallet");
  loadWalletInfo()
}

window.importWallet = async function importWallet() {
  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const seedphrase = document.querySelector('#enterSeedphrase').value;
  const derivationPath = "m/44'/0'/0'/0/0";
  const walletId = `seed:testnet:${seedphrase}:${derivationPath}`;
  await TestNetWallet.replaceNamed('mywallet', walletId);
  loadWalletInfo()
}

async function loadWalletInfo() {
  // Show My Wallet View
  changeView(0);
  const nav = document.querySelector('.nav');
  nav.classList.remove("hide");
  newWalletView.classList.add("hide");

  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const wallet = await TestNetWallet.named("mywallet");
  seedphrase.textContent = wallet.mnemonic;
  console.log(wallet)
  Config.EnforceCashTokenReceiptAddresses = true;

  // Import BCMR
  const url = "https://raw.githubusercontent.com/mr-zwets/example_bcmr/main/example_bcmr.json"
  await BCMR.addMetadataRegistryFromUri(url);

  // Display BCH balance and watch for changes
  let balance = await wallet.getBalance();
  let maxAmountToSend = await wallet.getMaxAmountToSend();
  if(unit == "tBCH"){
    const tbch = balance.sat / 100_000_000;
    document.querySelector('#balance').innerText = tbch;
    document.querySelector('#balanceUnit').innerText = ' tBCH';
  } else if(unit == "satoshis"){
    document.querySelector('#balance').innerText = balance.sat;
    document.querySelector('#balanceUnit').innerText = ' testnet satoshis';
  }
  wallet.watchBalance(async (newBalance) => {
    balance = newBalance;
    maxAmountToSend = await wallet.getMaxAmountToSend();
    if(unit == "tBCH"){
      const tbch = balance.sat / 100_000_000
      document.querySelector('#balance').innerText = tbch;
      document.querySelector('#balanceUnit').innerText = ' tBCH';
    } else if(unit == "satoshis"){
      document.querySelector('#balance').innerText = balance.sat;
      document.querySelector('#balanceUnit').innerText = ' testnet satoshis';
    }
  });
  // Display token categories, construct arrayTokens and watch for changes
  let arrayTokens = [];
  let tokenCategories = [];
  fetchTokens()
  async function fetchTokens() {
    arrayTokens = [];
    const getTokensResponse = await wallet.getAllTokenBalances();
    tokenCategories = Object.keys(getTokensResponse);
    document.querySelector('#tokenBalance').innerText = `${tokenCategories.length} different tokentypes`;
    for (const tokenId of tokenCategories) {
      if(getTokensResponse[tokenId]){
        arrayTokens.push({ tokenId, amount: getTokensResponse[tokenId] });
        continue;
      }
      // Otherwise tokenId has NFTs, so query utxos for tokenData
      const utxos = await wallet.getTokenUtxos(tokenId);
      for (const utxo of utxos) {
        const tokenData = utxo.token;
        arrayTokens.push({ tokenId, tokenData });
      }
    }
    // Either display tokens in wallet or display there are no tokens
    const divNoTokens = document.querySelector('#noTokensFound');
    if (arrayTokens.length) {
      divNoTokens.textContent = "";
      createListWithTemplate(arrayTokens);
    } else {
      divNoTokens.textContent = "Currently there are no tokens in this wallet";
    }
  }

  wallet.watchAddressTokenTransactions(async(tx) => fetchTokens());

  // Initilize address and display QR code
  const tokenAddr = await wallet.getTokenDepositAddress();
  document.querySelector('#depositAddr').innerText = tokenAddr;
  const qr = await wallet.getTokenDepositQr();
  document.querySelector('#depositQr').src = qr.src;

  // Functionality buttons BchWallet view
  window.maxBch = function maxBch(event) {
    if(unit == "tBCH"){
      event.currentTarget.parentElement.querySelector('#sendAmount').value = maxAmountToSend.bch;
    } else if(unit == "satoshis"){
      event.currentTarget.parentElement.querySelector('#sendAmount').value = maxAmountToSend.sat;
    }
  }
  document.querySelector('#send').addEventListener("click", async () => {
    try {
      const amount = document.querySelector('#sendAmount').value;
      const validInput = Number.isInteger(+amount) && +amount > 0;
      if(!validInput && unit=="satoshis") throw(`Amount satoshis to send must be a valid integer`);
      if(amount < 546 && unit=="satoshis") throw(`Must send atleast 546 satoshis`);
      const addr = document.querySelector('#sendAddr').value;
      const unitToSend = (unit == "tBCH")? "bch" : "sat";
      const { txId } = await wallet.send([{ cashaddr: addr, value: amount, unit: unitToSend }]);
      alert(`Sent ${amount} sats to ${addr}`);
      console.log(`Sent ${amount} sats to ${addr} \n${explorerUrl}/tx/${txId}`);
      document.querySelector('#sendAmount').value = "";
      document.querySelector('#sendAddr').value = "";
    } catch (error) { alert(error) }
  });

  // Functionality CreateTokens view depending on selected token-type
  document.querySelector('#createTokens').addEventListener("click", async () => {
    // Check if metadata url is added
    const url = document.querySelector('#bcmrUrl').value;
    let opreturnData
    if(url){
      try{
        const reponse = await fetch(url);
        const bcmrContent = await reponse.text();
        const hashContent = sha256.hash(utf8ToBin(bcmrContent)).reverse();
        const chunks = ["BCMR", hashContent, url];
        opreturnData = OpReturnData.fromArray(chunks);
        if(binToHex(opreturnData.buffer).length > 228) alert("url too long, can't fit into opreturn")
      } catch (error) {
        alert("Cant' read json data from the provided url. \nDouble check that the url links to a json object.")
        console.log(error);
        return
      }
    }
    // Check if fungibles are selected
    if(document.querySelector('#newtokens').value === "fungibles"){
      // Check inputField
      const tokenSupply = document.querySelector('#tokenSupply').value;
      const validInput = Number.isInteger(+tokenSupply) && +tokenSupply > 0;
      if(!validInput){alert(`Input total supply must be a valid integer`); return}
      // Create fungible tokens
      try {
        const genesisResponse = await wallet.tokenGenesis(
          {
            cashaddr: tokenAddr,
            amount: tokenSupply,            // fungible token amount
            value: 1000,                    // Satoshi value
          }, 
          opreturnData 
        );
        const tokenId = genesisResponse.tokenIds[0];
        const { txId } = genesisResponse;
        alert(`Created ${tokenSupply} fungible tokens of category ${tokenId}`);
        console.log(`Created ${tokenSupply} fungible tokens \n${explorerUrl}/tx/${txId}`);
        document.querySelector('#createTokensView').querySelectorAll('input').forEach(input => input.value = ""); 
        return txId
      } catch (error) { console.log(error) }
    }
    // If minting NFT is selected
    if(document.querySelector('#newtokens').value === "mintingNFT"){
    // Create minting token
      try{
        const genesisResponse = await wallet.tokenGenesis(
          {
            cashaddr: tokenAddr,
            commitment: "",             // NFT Commitment message
            capability: NFTCapability.minting, // NFT capability
            value: 1000,                    // Satoshi value
          },
          opreturnData 
        );
        const tokenId = genesisResponse.tokenIds[0];
        const { txId } = genesisResponse;

        alert(`Created minting NFT for category ${tokenId}`);
        console.log(`Created minting NFT for category ${tokenId} \n${explorerUrl}/tx/${txId}`);
        document.querySelector('#createTokensView').querySelectorAll('input').forEach(input => input.value = "");
        return txId
      }catch (error) { alert(error) }
    }
    // If immutable NFT is selected
    if(document.querySelector('#newtokens').value === "immutableNFT"){
      // Create an immutable NFT
      try{
        const commitmentInput = document.querySelector('#inputNftCommitment').value;
        const genesisResponse = await wallet.tokenGenesis(
          {
            cashaddr: tokenAddr,
            commitment: commitmentInput,    // NFT Commitment message
            capability: NFTCapability.none, // NFT capability
            value: 1000,                    // Satoshi value
          },
          opreturnData 
        );
        const tokenId = genesisResponse.tokenIds[0];
        const { txId } = genesisResponse;
  
        alert(`Created an immutable NFT for category ${tokenId}`);
        console.log(`Created an immutable NFT for category ${tokenId} \n${explorerUrl}/tx/${txId}`);
        document.querySelector('#createTokensView').querySelectorAll('input').forEach(input => input.value = "");
        return txId
      }catch (error) { alert(error) }
    }
  });

  document.querySelector('#view2').addEventListener("click", async () => {
    async function getValidPreGensis() {
      let walletUtxos = await wallet.getAddressUtxos();
      return walletUtxos.filter(utxo => !utxo.token && utxo.vout === 0);
    }
    let validPreGenesis= await getValidPreGensis()
    console.log(validPreGenesis)
    if(validPreGenesis.length === 0){
      document.querySelector("#plannedTokenId").textContent = 'loading...';
      document.querySelector("#plannedTokenId").value = "";
      await wallet.send([{ cashaddr: wallet.tokenaddr, value: 10000, unit: "sat" }]);
      console.log("Created output with vout zero for token genesis");
      validPreGenesis= await getValidPreGensis()
    }
    const tokenId = validPreGenesis[0].txid;
    const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
    document.querySelector("#plannedTokenId").textContent = displayId;
    document.querySelector("#plannedTokenId").value = tokenId;
  });

  // Create tokenlist
  function createListWithTemplate(tokens) {
    const Placeholder = document.getElementById("Placeholder");
    const ul = document.createElement("ul");
    ul.setAttribute("id", "Placeholder");
    const template = document.getElementById("token-template");

    tokens.forEach(async (token, index) => {
      const tokenCard = document.importNode(template.content, true);
      const tokenInfo = BCMR.getTokenInfo(token.tokenId);
      let decimals = 0;
      let symbol = "";
      if(tokenInfo){
        symbol = tokenInfo.token.symbol;
        decimals = tokenInfo.token.decimals;
      }
      // Display tokenID for fungibles & NFTs
      const displayId = `${token.tokenId.slice(0, 20)}...${token.tokenId.slice(-10)}`;
      tokenCard.querySelector("#tokenID").textContent = displayId;
      tokenCard.querySelector("#tokenID").value = token.tokenId;
      // Correct colors icons token-actionbar
      const actionbarIcons = tokenCard.querySelectorAll('.icon');
      if(darkMode) actionbarIcons.forEach(icon => icon.classList.add("dark"));
      if(tokenInfo){
        tokenCard.querySelector("#tokenName").textContent = `Name: ${tokenInfo.name}`;
        tokenCard.querySelector("#tokenBegin").textContent = `Creation date: ${tokenInfo.time.begin}`;
        tokenCard.querySelector("#tokenDescription").textContent = `Token description: ${tokenInfo.description}`;
        tokenCard.querySelector("#tokenDecimals").textContent = `Number of decimals: ${tokenInfo.token.decimals}`;
        const infoButton = tokenCard.querySelector('#infoButton');
        infoButton.classList.remove("hide");
        const tokenInfoDisplay = tokenCard.querySelector("#tokenInfoDisplay")
        infoButton.onclick = () => tokenInfoDisplay.classList.toggle("hide");
      }
      
      // Display tokenIcon whether generated or costum
      let icon = createIcon({
        seed: token.tokenId,
        size: 12,
        scale: 4,
        spotcolor: '#000'
      });
      if(tokenInfo && tokenInfo.uris.icon){
        icon = document.createElement("img");
        icon.src = tokenInfo.uris.icon;
        icon.style = "width:48px; max-width: inherit;";
      }
      const tokenIcon = tokenCard.querySelector("#tokenIcon");
      tokenIcon.appendChild(icon);
      // Stuff specific for fungibles
      if(token.amount){
        tokenCard.querySelector("#tokenType").textContent = "Fungible Tokens";
        const textTokenAmount = `${token.amount/(10**decimals)} ${symbol}`;
        tokenCard.querySelector("#tokenAmount").textContent = `Token amount: ${textTokenAmount}`;
        const tokenSend = tokenCard.querySelector('#tokenSend');
        tokenCard.getElementById("sendButton").onclick = () => tokenSend.classList.toggle("hide");
        const sendSomeButton = tokenSend.querySelector("#sendSomeButton");
        sendSomeButton.onclick = () => {
          let tokenAmount = Number(tokenSend.querySelector('#sendTokenAmount').value);
          const inputAddress = tokenSend.querySelector('#tokenAddress').value;
          sendTokens(inputAddress, tokenAmount, token.tokenId, tokenInfo);
        }
        function maxTokens(event) {
          let tokenAmount = token.amount;
          if(tokenInfo) tokenAmount = token.amount / (10 ** tokenInfo.token.decimals);
          event.currentTarget.parentElement.querySelector('#sendTokenAmount').value = tokenAmount;
        }
        tokenCard.getElementById("maxButton").onclick = (event) => maxTokens(event);
      } else{
        // Stuff specific for NFTs
        const tokenCapability = token.tokenData.capability;
        const nftTypes = {
          minting: "Minting NFT",
          mutable: "Mutable NFT",
          none: "Immutable NFT"
        };
        tokenCard.querySelector("#tokenType").textContent = nftTypes[tokenCapability];
        const tokenCommitment = token.tokenData.commitment;
        if (tokenCommitment != "") {
          const infoButton = tokenCard.querySelector('#infoButton');
          infoButton.classList.remove("hide");
          const tokenCommitmentInfo = tokenCard.querySelector("#tokenCommitment")
          infoButton.onclick = () => tokenCommitmentInfo.classList.toggle("hide");
          const commitmentText = `NFT commitment: ${tokenCommitment}`;
          tokenCard.querySelector("#tokenCommitment").textContent = commitmentText;
        }
        const nftSend = tokenCard.querySelector('#nftSend');
        tokenCard.getElementById("sendButton").onclick = () => nftSend.classList.toggle("hide");
        const sendNftButton = nftSend.querySelector("#sendNFT");
        sendNftButton.onclick = () => {
          const inputAddress = nftSend.querySelector('#tokenAddress').value;
          sendNft(inputAddress, token.tokenId, tokenCapability)
        }
        const nftMint = tokenCard.querySelector('#nftMint');
        if (tokenCapability == "minting"){ 
          const mintButton = tokenCard.querySelector('#mintButton');
          mintButton.classList.remove("hide");
          mintButton.onclick = () => nftMint.classList.toggle("hide");
        }
        const mintNftButton = nftMint.querySelector("#mintNFT");
        mintNftButton.onclick = () => {
          const commitmentInput = nftMint.querySelector('#commitmentInput').value;
          mintNft(token.tokenId, commitmentInput);
        }
        const mintNftsButton = nftMint.querySelector("#mintNFTs");
        mintNftsButton.onclick = () => {
          const amountNFTs = nftMint.querySelector('#amountNFTs').value;
          mintNft(token.tokenId, "", amountNFTs);
        }
      }
      ul.appendChild(tokenCard);
    });
    Placeholder.replaceWith(ul);
  }

  // Functionality buttons MyTokens view
  async function sendTokens(address, amountEntered, tokenId, tokenInfo) {
    try {
      const decimals = tokenInfo? tokenInfo.token.decimals : 0;
      const amountTokens = decimals ? amountEntered * (10 ** decimals) : amountEntered;
      const validInput = Number.isInteger(amountTokens) && amountTokens > 0;
      if(!validInput && !decimals) throw(`Amount tokens to send must be a valid integer`);
      if(!validInput && decimals) throw(`Amount tokens to send must only have ${decimals} decimal places`);
      const { txId } = await wallet.send([
        new TokenSendRequest({
          cashaddr: address,
          amount: amountTokens,
          tokenId: tokenId,
        }),
      ]);
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      let message = `Sent ${amountEntered} fungible tokens of category ${displayId} to ${address}`;
      if(tokenInfo) message = `Sent ${amountEntered} ${tokenInfo.token.symbol} to ${address}`;
      alert(message);
      console.log(`${message} \n${explorerUrl}/tx/${txId}`);
    } catch (error) { alert(error) }
  }

  async function sendNft(address, tokenId, tokenCapability) {
    try {
      const { txId } = await wallet.send([
        new TokenSendRequest({
          cashaddr: address,
          tokenId: tokenId,
          commitment: "",
          capability: tokenCapability,
        }),
      ]);
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Sent NFT of category ${displayId} to ${address}`);
      console.log(`Sent NFT of category ${displayId} to ${address} \n${explorerUrl}/tx/${txId}`);
    } catch (error) { alert(error) }
  }

  async function mintNft(tokenId, tokenCommitment, amount=1) {
    try {
      const isHex = (str) => /^[A-F0-9]+$/i.test(str);
      const validCommitment = (isHex(tokenCommitment) || tokenCommitment == "")
      if(!validCommitment) throw(`tokenCommitment '${tokenCommitment}' must be a hexadecimal`);
      const mintRequest = new TokenMintRequest({
        cashaddr: tokenAddr,
        commitment: tokenCommitment,
        capability: NFTCapability.none,
        value: 1000,
      })
      const arraySendrequests = [];
      for (let i = 0; i < amount; i++) arraySendrequests.push(mintRequest);
      const { txId } = await wallet.tokenMint(
        tokenId,
        arraySendrequests
      );
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      const commitmentText= tokenCommitment? `with commitment ${tokenCommitment}`: "";
      if(amount == 1){
        alert(`Minted immutable NFT of category ${displayId} ${commitmentText}`);
        console.log(`Minted immutable NFT of category ${displayId} ${commitmentText} \n${explorerUrl}/tx/${txId}`);
      } else {
        alert(`Minted ${amount} NFTs of category ${displayId}`);
        console.log(`Minted ${amount} immutable NFT of category ${displayId} \n${explorerUrl}/tx/${txId}`);
      }
      
    } catch (error) { alert(error) }
  }
}

// Logic for copy onclick
window.copyTextContent = function copyTextContent(id) {
  var element = document.getElementById(id);
  navigator.clipboard.writeText(element.textContent);
}
window.copyTokenID = function copyTokenID(event, id='tokenID') {
  navigator.clipboard.writeText(event.currentTarget.parentElement.querySelector(`#${id}`).value)
}

// Change view logic
window.changeView = function changeView(newView) {
  const views = ['walletView','tokenView','createTokensView','settingsView'];
  // First hide all views
  views.forEach((view, index) => {
    document.querySelector(`#${view}`).classList.add("hide");
    document.querySelector(`#view${index}`).classList = "view";
  })
  // Show selected view & highlight in nav
  document.querySelector(`#${views[newView]}`).classList.remove("hide");
  document.querySelector(`#view${newView}`).classList = "view active";
}

// Change create token view
window.selectTokenType = function selectTokenType(event){
  const tokenSupply = document.querySelector('#tokenSupply').parentElement;
  const tokenCommitment = document.querySelector('#inputNftCommitment').parentElement;
  tokenSupply.classList.add("hide");
  tokenCommitment.classList.add("hide");
  if(event.target.value === "fungibles") tokenSupply.classList.remove("hide");
  if(event.target.value === "immutableNFT") tokenCommitment.classList.remove("hide");
}

// Change default unit
window.selectUnit = function selectUnit(event){
  const oldUnit = unit
  if(oldUnit == "tBCH"){
    const tbch = document.querySelector('#balance').innerText;
    const balanceSatoshis = tbch * 100_000_000;
    document.querySelector('#balance').innerText = balanceSatoshis;
    document.querySelector('#balanceUnit').innerText = ' testnet satoshis';
    document.querySelector('#sendAmount').placeholder = ' amount satoshis';
  } else if(oldUnit == "satoshis"){
  const balanceSatoshis = document.querySelector('#balance').innerText;
    const tbch = balanceSatoshis / 100_000_000;
    document.querySelector('#balance').innerText = tbch;
    document.querySelector('#balanceUnit').innerText = ' tBCH';
    document.querySelector('#sendAmount').placeholder = ' tBCH amount';
  }
  localStorage.setItem("unit", `${event.target.value}`);
  unit = event.target.value;
}

window.toggleSeedphrase = (event) => {
  seedphrase.classList.toggle("hide");
  const isHidden = seedphrase.classList.contains("hide");
  event.srcElement.value = isHidden ? "Show seed phrase" : "Hide seed phrase";
}
