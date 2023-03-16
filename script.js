import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs } from './queryChainGraph.js';

const explorerUrl = "https://chipnet.chaingraph.cash";



const newWalletView = document.querySelector('#newWalletView');
const footer = document.querySelector('.footer');
const seedphrase = document.getElementById("seedphrase");

// Logic dark mode
let darkMode = false;
const readDarkMode = localStorage.getItem("darkMode");
if (readDarkMode === "true") {
  document.querySelector('.js-switch').checked = true;
  toggleDarkmode();
}
if (readDarkMode == undefined && matchMedia &&
window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('.js-switch').checked = true;
  toggleDarkmode();
}
// see switchery docs
const elem = document.querySelector('.js-switch');
const init = new Switchery(elem, { size: 'small', color:"#0ac18f"});
const changeCheckbox = document.querySelector('.js-check-change');
changeCheckbox.onchange = () => toggleDarkmode();
function toggleDarkmode() {
  darkMode = !darkMode;
  document.body.classList= darkMode? "dark" : "";
  const icons = document.querySelectorAll('.icon');
  if(darkMode) icons.forEach(icon => icon.classList.add("dark"));
  else icons.forEach(icon => icon.classList.remove("dark"));
  localStorage.setItem("darkMode", `${darkMode}`);
  document.querySelector('#darkmode').checked = darkMode;
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
    document.querySelector('#sendUnit').innerText = ' tBCH';
  } else if(unit == "satoshis"){
    document.querySelector('#balance').innerText = balance.sat;
    document.querySelector('#balanceUnit').innerText = ' testnet satoshis';
    document.querySelector('#sendUnit').innerText = ' sats';
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

  // Initilize address and display QR code
  const regularAddr = await wallet.getDepositAddress();
  const tokenAddr = await wallet.getTokenDepositAddress();
  document.querySelector('#depositAddr').innerText = regularAddr;
  document.querySelector('#depositTokenAddr').innerText = tokenAddr;
  document.querySelector('#qr1').contents = regularAddr;
  document.querySelector('#qr2').contents = tokenAddr;
  document.querySelector('#placeholderQr').classList.add("hide");
  document.querySelector('#qr1').classList.remove("hide");

  // Display token categories, construct arrayTokens and watch for changes
  let arrayTokens = [];
  let tokenCategories = [];
  fetchTokens();
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
      importRegistries(arrayTokens);
    } else {
      divNoTokens.textContent = "Currently there are no tokens in this wallet";
    }
  }

  wallet.watchAddressTokenTransactions(async(tx) => fetchTokens());

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
    const httpsSelected = document.querySelector('#ipfsInfo').classList.contains("hide");
    const url = document.querySelector('#bcmrUrl').value;
    const bcmrIpfs = document.querySelector('#bcmrIpfs').value;
    let opreturnData
    if(httpsSelected && url){
      try{
        const reponse = await fetch("https://" + url);
        const bcmrContent = await reponse.text();
        const hashContent = sha256.hash(utf8ToBin(bcmrContent)).reverse();
        const chunks = ["BCMR", hashContent, url];
        opreturnData = OpReturnData.fromArray(chunks);
      } catch (error) {
        alert("Cant' read json data from the provided url. \nDouble check that the url links to a json object.")
        console.log(error);
        return
      }
    }
    if(!httpsSelected && bcmrIpfs){
      try{
        const chunks = ["BCMR", bcmrIpfs];
        opreturnData = OpReturnData.fromArray(chunks);
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
        document.querySelector('#createTokensView').querySelectorAll('input:not([type=button])').forEach(input => input.value = ""); 
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
        document.querySelector('#createTokensView').querySelectorAll('input:not([type=button])').forEach(input => input.value = "");
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
        document.querySelector('#createTokensView').querySelectorAll('input:not([type=button])').forEach(input => input.value = "");
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

  // Import onchain resolved BCMRs
  async function importRegistries(tokens) {
    tokens.forEach(async (token, index) => {
      try{
        const authChain = await BCMR.addMetadataRegistryAuthChain({
          transactionHash: token.tokenId,
          followToHead: true,
          network: Network.TESTNET
        });
        if(authChain){
          console.log("Importing an on-chain resolved BCMR!");
          await BCMR.addMetadataRegistryFromUri(authChain[0].uri);
          reRenderToken(token, index);
        }
      } catch(error){ }
    })
  }
  
  // Rerender token after new tokenInfo
  function reRenderToken(token, index) {
    const tokenCard = document.querySelectorAll(".item")[index];
    const tokenInfo = BCMR.getTokenInfo(token.tokenId);
    console.log("re-rendering token with new tokenInfo");
    if(tokenInfo){
      const symbol = tokenInfo.token.symbol || "";
      const decimals = tokenInfo.token.decimals || 0;
      tokenCard.querySelector("#tokenName").textContent = `Name: ${tokenInfo.name}`;
      tokenCard.querySelector("#tokenBegin").textContent = `Creation date: ${tokenInfo.time.begin}`;
      if(tokenInfo.description) tokenCard.querySelector("#tokenDescription").textContent = `Token description: ${tokenInfo.description}`;
      tokenCard.querySelector("#tokenDecimals").textContent = `Number of decimals: ${tokenInfo.token.decimals}`;
      tokenCard.querySelector("#sendUnit").textContent = symbol;
      const textTokenAmount = `${token.amount/(10**decimals)} ${symbol}`;
      tokenCard.querySelector("#tokenAmount").textContent = `Token amount: ${textTokenAmount}`;
      const BCMRs = BCMR.getRegistries();
      const hardCodedBCMR = BCMRs[0];
      const isVerified = hardCodedBCMR.identities[token.tokenId];
      tokenCard.querySelector("#verified").classList.remove("hide");
      if(!isVerified){
        tokenCard.querySelector(".verifiedIcon").classList = "unverifiedIcon";
        tokenCard.querySelector(".tooltiptext").textContent = "Unverified";
      } 
    }
    if(tokenInfo && tokenInfo.uris && tokenInfo.uris.icon){
      const icon = document.createElement("img");
      icon.src = tokenInfo.uris.icon;
      icon.style = "width:48px; max-width: inherit;";
      const tokenIcon = tokenCard.querySelector("#tokenIcon");
      tokenIcon.removeChild(tokenIcon.lastChild);
      tokenIcon.appendChild(icon);
    }
  }

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
        if(tokenInfo.description) tokenCard.querySelector("#tokenDescription").textContent = `Token description: ${tokenInfo.description}`;
        tokenCard.querySelector("#tokenDecimals").textContent = `Number of decimals: ${tokenInfo.token.decimals}`;
        tokenCard.querySelector("#sendUnit").textContent = symbol;
        const BCMRs = BCMR.getRegistries();
        const hardCodedBCMR = BCMRs[0];
        const isVerified = hardCodedBCMR.identities[token.tokenId];
        tokenCard.querySelector("#verified").classList.remove("hide");
        if(!isVerified){
          tokenCard.querySelector(".verifiedIcon").classList = "unverifiedIcon";
          tokenCard.querySelector(".tooltiptext").textContent = "Unverified";
        } 
      }
      // TokenInfo display with queries onclick
      const tokenInfoDisplay = tokenCard.querySelector("#tokenInfoDisplay");
      const infoButton = tokenCard.querySelector('#infoButton');
      const onchainTokenInfo = tokenCard.querySelector('#onchainTokenInfo');
      infoButton.onclick = async () => {
        tokenInfoDisplay.classList.toggle("hide");
        const alreadyLoaded = onchainTokenInfo.textContent;
        if(token.amount && !alreadyLoaded){
          // Fetch total token supply
          const responseJson = await queryTotalSupplyFT(token.tokenId);
          const totalAmount = responseJson.data.transaction[0].outputs.reduce((total, output) => total +  parseInt(output.fungible_token_amount),0);
          onchainTokenInfo.textContent = `Genesis supply: ${totalAmount} tokens`;
          console.log(`Fetched genesis supply from chaingraph demo instance`);
        } else if(!alreadyLoaded){
          // Has active minting NFT
          const responseJson = await queryActiveMinting(token.tokenId);
          let textOnchainTokenInfo = (responseJson.data.output.length)? "Has an active minting NFT":"Does not have an active minting NFT";
          const responseJson2 = await querySupplyNFTs(token.tokenId);
          textOnchainTokenInfo += ` \r\n Total supply: ${responseJson2.data.output.length} NFTs`;
          onchainTokenInfo.textContent = textOnchainTokenInfo;
          console.log(`Fetched existance of active minting tokens from chaingraph demo instance`);
        }
      }
      
      // Display tokenIcon whether generated or costum
      let icon = createIcon({
        seed: token.tokenId,
        size: 12,
        scale: 4,
        spotcolor: '#000'
      });
      if(tokenInfo && tokenInfo.uris && tokenInfo.uris.icon){
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
        const nftBurn = tokenCard.querySelector('#nftBurn');
        if (tokenCapability == "minting"){ 
          const mintButton = tokenCard.querySelector('#mintButton');
          const burnButton = tokenCard.querySelector('#burnButton');
          mintButton.classList.remove("hide");
          mintButton.onclick = () => nftMint.classList.toggle("hide");
          burnButton.classList.remove("hide");
          burnButton.onclick = () => nftBurn.classList.toggle("hide");
        }
        const mintNftButton = nftMint.querySelector("#mintNFT");
        mintNftButton.onclick = () => {
          const commitmentInput = nftMint.querySelector('#commitmentInput').value;
          mintNft(token.tokenId, commitmentInput);
        }
        const burnNftButton = nftBurn.querySelector("#burnNFT");
        burnNftButton.onclick = () => {
          burnNft(token.tokenId, tokenCommitment);
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

  async function burnNft(tokenId, tokenCommitment) {
    try {
      const { txId } = await wallet.tokenBurn(
        {
          tokenId: tokenId,
          capability: NFTCapability.minting,
          commitment: tokenCommitment,
        },
        "burn", // optional OP_RETURN message
      );
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Burned minting NFT of category ${displayId}`);
      console.log(`Burned minting NFT of category ${displayId} \n${explorerUrl}/tx/${txId}`);
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

window.selectUri = function selectUri(event){
  const httpsInfo = document.querySelector('#httpsInfo');
  const ipfsInfo = document.querySelector('#ipfsInfo');
  httpsInfo.classList.add("hide");
  ipfsInfo.classList.add("hide");
  if(event.target.value === "HTTPS") httpsInfo.classList.remove("hide");
  if(event.target.value === "IPFS") ipfsInfo.classList.remove("hide");
}

// Change default unit
window.selectUnit = function selectUnit(event){
  const oldUnit = unit;
  if(oldUnit == "tBCH"){
    const tbch = document.querySelector('#balance').innerText;
    const balanceSatoshis = tbch * 100_000_000;
    document.querySelector('#balance').innerText = balanceSatoshis;
    document.querySelector('#balanceUnit').innerText = ' testnet satoshis';
    document.querySelector('#sendUnit').innerText = ' sats';
  } else if(oldUnit == "satoshis"){
  const balanceSatoshis = document.querySelector('#balance').innerText;
    const tbch = balanceSatoshis / 100_000_000;
    document.querySelector('#balance').innerText = tbch;
    document.querySelector('#balanceUnit').innerText = ' tBCH';
    document.querySelector('#sendUnit').innerText = ' tBCH';
  }
  localStorage.setItem("unit", `${event.target.value}`);
  unit = event.target.value;
  document.querySelector('#sendAmount').value = "";
}

window.toggleSeedphrase = (event) => {
  seedphrase.classList.toggle("hide");
  const isHidden = seedphrase.classList.contains("hide");
  event.srcElement.value = isHidden ? "Show seed phrase" : "Hide seed phrase";
}

window.switchAddressType = () => {
  const currentQrCode = document.querySelector('qr-code:not(.hide)');
  const otherQrCode = document.querySelector('qr-code.hide');
  currentQrCode.classList.add("hide");
  otherQrCode.classList.remove("hide");
  otherQrCode.animateQRCode('MaterializeIn');
}
