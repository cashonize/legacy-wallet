import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs } from './queryChainGraph.js';

const explorerUrl = "https://chipnet.chaingraph.cash";
const trustedTokenLists = [
  "https://otr.cash/.well-known/bitcoin-cash-metadata-registry.json",
  "https://raw.githubusercontent.com/mr-zwets/example_bcmr/main/example_bcmr.json"
];
const nameWallet = "mywallet";

const newWalletView = document.querySelector('#newWalletView');
const footer = document.querySelector('.footer');
const seedphrase = document.getElementById("seedphrase");

// Logic dark mode
let darkMode = false;
const readDarkMode = localStorage.getItem("darkMode");
if (readDarkMode === "true") {
  document.querySelector('#darkmode').checked = true;
  toggleDarkmode();
}
if (readDarkMode == undefined && matchMedia &&
window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('#darkmode').checked = true;
  toggleDarkmode();
}
document.querySelector('#verifiedOnlySwitch').checked = false;
// see switchery docs
let elems = Array.prototype.slice.call(document.querySelectorAll('.js-switch'));
elems.forEach(elem => {
  const switchery = new Switchery(elem, { size: 'small', color:"#0ac18f"});
});
const changeDarkMode = document.querySelector('#darkmode');
changeDarkMode.onchange = () => toggleDarkmode();
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
let unit = readUnit || 'BCH';

// Logic network
const readNetwork = localStorage.getItem("network");
let network = "mainnet"
let walletClass

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

  const mainnetWalletExists = await Wallet.namedExists(nameWallet);
  const testnetWalletExists = await TestNetWallet.namedExists(nameWallet);
  const walletExists = mainnetWalletExists || testnetWalletExists;
  walletClass = Wallet

  if(!readNetwork && walletExists){
    network = mainnetWalletExists ? "mainnet" : "chipnet";
    localStorage.setItem("network", network);
  }
  if(readNetwork) network = readNetwork;
  document.querySelector('#selectNetwork').value = network;
  if(network === "chipnet") walletClass = TestNetWallet;
  footer.classList.remove("hide");
  if(!walletExists) newWalletView.classList.remove("hide");
  else{loadWalletInfo()};
})

window.createNewWallet = async function createNewWallet() {
  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  Config.DefaultParentDerivationPath = "m/44'/145'/0'";
  await walletClass.named(nameWallet);
  loadWalletInfo()
}

window.importWallet = async function importWallet() {
  // Initialize wallet
  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const seedphrase = document.querySelector('#enterSeedphrase').value;
  const selectedDerivationPath = document.querySelector('#derivationPath').value;
  const derivationPath = selectedDerivationPath == "standard"? "m/44'/145'/0'/0/0" : "m/44'/0'/0'/0/0";
  const walletId = `seed:testnet:${seedphrase}:${derivationPath}`;
  await walletClass.replaceNamed(nameWallet, walletId);
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
  const wallet = await walletClass.named(nameWallet);
  seedphrase.textContent = wallet.mnemonic;
  document.querySelector('#walletDerivationPath').textContent = wallet.derivationPath;
  console.log(wallet);
  Config.EnforceCashTokenReceiptAddresses = true;

  // Import BCMRs in the trusted tokenlists
  for await(const tokenListUrl of trustedTokenLists){
    await BCMR.addMetadataRegistryFromUri(tokenListUrl);
  }

  // Display USD & BC balance and watch for changes
  let balance = await wallet.getBalance();
  let maxAmountToSend = await wallet.getMaxAmountToSend();
  if(unit == "satoshis"){
    document.querySelector('#balance').innerText = balance.sat;
    const bchUnit = network === "mainnet" ? " satoshis" : " testnet satoshis"; 
    document.querySelector('#balanceUnit').innerText = bchUnit;
    document.querySelector('#sendUnit').innerText = ' sats';
  } else {
    const bch = balance.sat / 100_000_000;
    document.querySelector('#balance').innerText = bch;
    const bchUnit = network === "mainnet" ? " BCH" : " tBCH"; 
    document.querySelector('#balanceUnit').innerText = bchUnit;
    document.querySelector('#sendUnit').innerText = bchUnit;
  }
  document.querySelector('#balanceUsd').innerText = `${balance.usd} $`;
  const showUsdString = network === "chipnet"? "none" : "block";
  document.querySelector('#showsUsdBalance').style = `display: ${showUsdString}`;
  wallet.watchBalance(async (newBalance) => {
    balance = newBalance;
    maxAmountToSend = await wallet.getMaxAmountToSend();
    if(unit == "satoshis"){
      document.querySelector('#balance').innerText = balance.sat;
      const satsUnit = network === "mainnet" ? " satoshis" : " testnet satoshis"; 
      document.querySelector('#balanceUnit').innerText = satsUnit;
    } else{
      const bch = balance.sat / 100_000_000
      document.querySelector('#balance').innerText = bch;
      const bchUnit = network === "mainnet" ? " BCH" : " tBCH"; 
      document.querySelector('#balanceUnit').innerText = bchUnit;
    }
    document.querySelector('#balanceUsd').innerText = `${balance.usd} $`;
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
  let importedRegistries = false;
  fetchTokens();
  async function fetchTokens() {
    arrayTokens = [];
    const getFungibleTokensResponse = await wallet.getAllTokenBalances();
    const getNFTsResponse = await wallet.getAllNftTokenBalances();
    tokenCategories = Object.keys({...getFungibleTokensResponse, ...getNFTsResponse})
    document.querySelector('#tokenBalance').innerText = `${tokenCategories.length} different token categories`;
    for (const tokenId of Object.keys(getFungibleTokensResponse)) {
      arrayTokens.push({ tokenId, amount: getFungibleTokensResponse[tokenId] });
    }
    for (const tokenId of Object.keys(getNFTsResponse)) {
      const utxos = await wallet.getTokenUtxos(tokenId);
      if(utxos.length == 1){
        const tokenData = utxos[0].token;
        arrayTokens.push({ tokenId, tokenData });
        continue;
      } else {
        const nfts = [];
        for (const utxo of utxos) {
          const tokenData = utxo.token;
          if(tokenData.capability) nfts.push({ tokenId, tokenData });
        }
        arrayTokens.push({ tokenId, nfts });
      }
    }
    // Either display tokens in wallet or display there are no tokens
    const divNoTokens = document.querySelector('#noTokensFound');
    document.querySelector('#loadingTokenData').classList.add("hide");
    const divVerifiedOnly = document.querySelector('#verifiedOnly');
    createListWithTemplate(arrayTokens);
    if (arrayTokens.length) {
      divNoTokens.classList.add("hide");
      divVerifiedOnly.classList.remove("hide");
      if(!importedRegistries) importRegistries(arrayTokens);
      importedRegistries = true;
    } else {
      divNoTokens.classList.remove("hide");
      divVerifiedOnly.classList.add("hide");
    }
  }

  wallet.watchAddressTokenTransactions(async(tx) => fetchTokens());

  // Functionality buttons BchWallet view
  window.maxBch = function maxBch(event) {
    if(unit == "BCH"){
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
      const unitToSend = (unit == "BCH")? "bch" : "sat";
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
    const inputField = httpsSelected ? url : bcmrIpfs;
    let validinput = httpsSelected? !inputField.startsWith("http"): inputField.startsWith("ipfs://");
    if(!validinput){
      httpsSelected ? alert("Urls should not have any prefix!") : alert("Ipfs location should start with ipfs prefix!");
      return
    }
    let opreturnData
    if(inputField && validinput){
      try{
        const fetchLocation = httpsSelected ? "https://" + url : "https://" + bcmrIpfs.slice(7) + ".ipfs.dweb.link"
        const reponse = await fetch(fetchLocation);
        const bcmrContent = await reponse.text();
        const hashContent = sha256.hash(utf8ToBin(bcmrContent));
        const chunks = ["BCMR", hashContent, inputField];
        opreturnData = OpReturnData.fromArray(chunks);
      } catch (error) {
        alert("Cant' read json data from the provided location. \nDouble check that the provided link contains to a json object.")
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
        const authChain = await BCMR.buildAuthChain({
          transactionHash: token.tokenId,
          followToHead: true,
          network: Network.TESTNET
        })
        if(authChain[0]){
          try{
            const reponse = await fetch(authChain[0].uri);
            const json = await reponse.json();
            await BCMR.addMetadataRegistryFromUri(authChain[0].uri);
            console.log("Importing an on-chain resolved BCMR!");
            reRenderToken(token, index);
          }catch(e){ console.log(e) }
        }
      } catch(error){ }
    })
  }
  
  // Rerender token after new tokenInfo
  function reRenderToken(token, index) {
    const tokenCard = document.querySelector("#Placeholder").children[index];
    const tokenInfo = BCMR.getTokenInfo(token.tokenId);
    console.log("re-rendering token with new tokenInfo");
    if(tokenInfo){
      const symbol = tokenInfo.token.symbol || "";
      tokenCard.querySelector("#tokenName").textContent = `Name: ${tokenInfo.name}`;
      if(tokenInfo.description) tokenCard.querySelector("#tokenDescription").textContent = `Token description: ${tokenInfo.description}`;
      if(tokenInfo.uris.web) tokenCard.querySelector("#tokenWebLink").textContent = `Token web link: ${tokenInfo.uris.web}`;
      if(token.amount){
        tokenCard.querySelector("#sendUnit").textContent = symbol;
        const decimals = tokenInfo.token.decimals || 0;
        const textTokenAmount = `${token.amount/(10**decimals)} ${symbol}`;
        tokenCard.querySelector("#tokenAmount").textContent = `Token amount: ${textTokenAmount}`;
        tokenCard.querySelector("#tokenDecimals").textContent = `Number of decimals: ${decimals}`;
      }
      const BCMRs = BCMR.getRegistries();
      const hardCodedBCMR = BCMRs[0];
      const isVerified = hardCodedBCMR.identities[token.tokenId];
      tokenCard.querySelector("#verified").classList.remove("hide");
      if(!isVerified){
        tokenCard.querySelector(".verifiedIcon").classList = "unverifiedIcon";
        tokenCard.querySelector(".tooltiptext").textContent = "Unverified";
      }
      function newIcon(element, iconSrc){
        const icon = document.createElement("img");
        if(iconSrc.startsWith("ipfs://")) iconSrc = "https://dweb.link/ipfs/"+iconSrc.slice(7);
        icon.src = iconSrc;
        icon.style = "width:48px; max-width:inherit; border-radius:50%;";
        const tokenIcon = element.querySelector("#tokenIcon");
        tokenIcon.removeChild(tokenIcon.lastChild);
        tokenIcon.appendChild(icon);
      }
      if(tokenInfo.uris && tokenInfo.uris.icon) newIcon(tokenCard, tokenInfo.uris.icon);
      if(token.tokenData){
        const NFTmetadata = tokenInfo.token.nfts.parse.types[(token.tokenData.commitment)];
        if(NFTmetadata && NFTmetadata.uris && NFTmetadata.uris.icon){
          newIcon(tokenCard, NFTmetadata.uris.icon)
        }
      }
      if(token.nfts){
        const children = tokenCard.children;
        for(let i=1; i<children.length; i++){
          const nftCard = children[i];
          const nft = token.nfts[i-1];
          const NFTmetadata = tokenInfo.token.nfts.parse.types[(nft.tokenData.commitment)];
          if(NFTmetadata) nftCard.querySelector("#tokenName").textContent = `Name: ${NFTmetadata.name}`;
          if(NFTmetadata && NFTmetadata.uris && NFTmetadata.uris.icon){
            newIcon(nftCard, NFTmetadata.uris.icon);
          } else if(tokenInfo.uris && tokenInfo.uris.icon){
            newIcon(nftCard, tokenInfo.uris.icon);
          }
        }
      }
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
        if(tokenInfo.description) tokenCard.querySelector("#tokenDescription").textContent = `Token description: ${tokenInfo.description}`;
        if(tokenInfo.uris.web) tokenCard.querySelector("#tokenWebLink").textContent = `Token web link: ${tokenInfo.uris.web}`;
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
          textOnchainTokenInfo += ` \r\n Total supply: ${responseJson2.data.output.length} immutable NFTs`;
          onchainTokenInfo.textContent = textOnchainTokenInfo;
          console.log(`Fetched existance of active minting tokens from chaingraph demo instance`);
        }
      }
      // Reusable function so it can also render icons for child nfts
      function generateIcon(element, nftCommitment){
        // Display tokenIcon whether generated or costum
        let icon = createIcon({
          seed: token.tokenId,
          size: 12,
          scale: 4,
          spotcolor: '#000'
        });
        if(tokenInfo && tokenInfo.uris && tokenInfo.uris.icon){
          icon = document.createElement("img");
          let iconSrc = tokenInfo.uris.icon;
          if(token.tokenData){
            const NFTmetadata = tokenInfo.token.nfts.parse.types[(token.tokenData.commitment)];
            if(NFTmetadata && NFTmetadata.uris && NFTmetadata.uris.icon){
              iconSrc = NFTmetadata.uris.icon;
            }
          }
          if(token.nfts){
            const NFTmetadata = tokenInfo.token.nfts.parse.types[nftCommitment];
            if(NFTmetadata && NFTmetadata.uris && NFTmetadata.uris.icon){
              iconSrc = NFTmetadata.uris.icon;
            }
          }
          if(iconSrc.startsWith("ipfs://")) iconSrc = "https://dweb.link/ipfs/"+iconSrc.slice(7);
          icon.src = iconSrc;
          icon.style = "width:48px; max-width: inherit;";
        }
        const tokenIcon = element.querySelector("#tokenIcon");
        tokenIcon.appendChild(icon);
      }
      generateIcon(tokenCard)
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
      } 
      if(token.tokenData) renderNft(token, tokenCard)
      // Reusable function so it can also render child nfts
      function renderNft(nft, element){
        // Stuff specific for NFTs
        const tokenCapability = nft.tokenData.capability;
        const nftTypes = {
          minting: "Minting NFT",
          mutable: "Mutable NFT",
          none: "Immutable NFT"
        };
        element.querySelector("#tokenType").textContent = nftTypes[tokenCapability];
        const tokenCommitment = nft.tokenData.commitment;
        if (tokenCommitment != "") {
          const commitmentText = `NFT commitment: ${tokenCommitment}`;
          element.querySelector("#tokenCommitment").textContent = commitmentText;
        }
        const nftSend = element.querySelector('#nftSend');
        element.getElementById("sendButton").onclick = () => nftSend.classList.toggle("hide");
        const sendNftButton = nftSend.querySelector("#sendNFT");
        sendNftButton.onclick = () => {
          const inputAddress = nftSend.querySelector('#tokenAddress').value;
          sendNft(inputAddress, nft.tokenId, tokenCapability, tokenCommitment)
        }
        const nftMint = element.querySelector('#nftMint');
        const nftBurn = element.querySelector('#nftBurn');
        if (tokenCapability == "minting"){ 
          const mintButton = element.querySelector('#mintButton');
          const burnButton = element.querySelector('#burnButton');
          mintButton.classList.remove("hide");
          mintButton.onclick = () => nftMint.classList.toggle("hide");
          burnButton.classList.remove("hide");
          burnButton.onclick = () => nftBurn.classList.toggle("hide");
        }
        const mintNftButton = nftMint.querySelector("#mintNFT");
        mintNftButton.onclick = () => {
          const commitmentInput = nftMint.querySelector('#commitmentInput').value;
          mintNft(nft.tokenId, commitmentInput);
        }
        const burnNftButton = nftBurn.querySelector("#burnNFT");
        burnNftButton.onclick = () => {
          burnNft(nft.tokenId, tokenCommitment);
        }
        const mintNftsButton = nftMint.querySelector("#mintNFTs");
        mintNftsButton.onclick = () => {
          const amountNFTs = nftMint.querySelector('#amountNFTs').value;
          mintNft(nft.tokenId, "", amountNFTs);
        }
      } if(token.nfts){
        tokenCard.querySelector("#tokenType").textContent = "NFT group";
        tokenCard.querySelector("#nrChildNfts").textContent = `Number NFTs: ${token.nfts.length}`;
        tokenCard.querySelector('#sendButton').classList.add("hide");
        tokenCard.querySelector("#showMore").classList.remove("hide");

        for(let i=0; i< token.nfts.length; i++){
          const childNft = document.importNode(template.content, true);
          childNft.querySelector(".item").style.marginLeft = "25px";
          childNft.querySelector(".item").classList.add("hide");
          const nftCommitment = token.nfts[i].tokenData.commitment
          generateIcon(childNft, nftCommitment);
          renderNft(token.nfts[i],childNft);
          childNft.querySelector("#tokenIdBox").classList.add("hide");
          childNft.querySelector("#infoButton").classList.add("hide");
          childNft.querySelector("#childNftCommitment").classList.remove("hide");
          const childNftCommitment = nftCommitment || 'none'
          childNft.querySelector("#childNftCommitment").textContent = `Commitment: ${childNftCommitment}`

          tokenCard.querySelector(".item").appendChild(childNft);
        }
        // use the querySelector outside the function
        const showIcon = tokenCard.querySelector("#showIcon");
        function toggleChildNfts() {
          const group = document.querySelector("#Placeholder").children[index];
          showIcon.classList.toggle("less");
          const children = group.querySelectorAll(".item");
          children.forEach(child => child.classList.toggle("hide"));
        }
        tokenCard.querySelector("#childNfts").onclick = toggleChildNfts;
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
    } catch (error) { 
      alert(error);
      console.log(error);
    }
  }

  async function sendNft(address, tokenId, tokenCapability, tokenCommitment) {
    try {
      const { txId } = await wallet.send([
        new TokenSendRequest({
          cashaddr: address,
          tokenId: tokenId,
          commitment: tokenCommitment,
          capability: tokenCapability,
        }),
      ]);
      console.log(tokenCommitment, tokenCapability)
      const displayId = `${tokenId.slice(0, 20)}...${tokenId.slice(-10)}`;
      alert(`Sent NFT of category ${displayId} to ${address}`);
      console.log(`Sent NFT of category ${displayId} to ${address} \n${explorerUrl}/tx/${txId}`);
    } catch (error) { 
      alert(error);
      console.log(error);
    }
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

// Verified only switch
let displayVerifiedOnly = false;
const changeVerifiedOnly = document.querySelector('#verifiedOnlySwitch');
changeVerifiedOnly.onchange = () => toggleVerifiedOnly();
function toggleVerifiedOnly() {
  displayVerifiedOnly = !displayVerifiedOnly;
  document.querySelector('#noVerifiedTokens').classList.add("hide");
  const tokenCards = document.querySelector("#Placeholder").children;
  if(displayVerifiedOnly){
    for(const tokenCard of tokenCards){
        tokenCard.classList.add("hide");
        const isVerified = tokenCard.children[0].querySelector('.verifiedIcon') && !tokenCard.querySelector('#verified').classList.contains("hide");
        if(isVerified) tokenCard.classList.remove("hide");
      }
      const shownTokenCards = document.querySelectorAll(".item:not(.hide)");
      if(!shownTokenCards[0]) document.querySelector('#noVerifiedTokens').classList.remove("hide");
  } else {
    for(const tokenCard of tokenCards){
      tokenCard.classList.remove("hide");
    }
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
  if(oldUnit == "BCH"){
    const bch = document.querySelector('#balance').innerText;
    const balanceSatoshis = bch * 100_000_000;
    const satsUnit = network === "mainnet" ? " satoshis" : " testnet satoshis"; 
    document.querySelector('#balance').innerText = balanceSatoshis;
    document.querySelector('#balanceUnit').innerText = satsUnit;
    document.querySelector('#sendUnit').innerText = ' sats';
  } else if(oldUnit == "satoshis"){
  const balanceSatoshis = document.querySelector('#balance').innerText;
    const bch = balanceSatoshis / 100_000_000;
    document.querySelector('#balance').innerText = bch;
    const bchUnit = network === "mainnet" ? " BCH" : " tBCH"; 
    document.querySelector('#balanceUnit').innerText = bchUnit;
    document.querySelector('#sendUnit').innerText = bchUnit;
  }
  localStorage.setItem("unit", `${event.target.value}`);
  unit = event.target.value;
  document.querySelector('#sendAmount').value = "";
}

// Change network
window.changeNetwork = function changeNetwork(event){
  network = event.target.value;
  walletClass = network === "chipnet" ? TestNetWallet : Wallet;
  localStorage.setItem("network", network);
  loadWalletInfo();
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
