document.addEventListener("DOMContentLoaded", async (event) => {
  // make sure rest of code executes after mainnet-js has been imported properly
  Object.assign(globalThis, await __mainnetPromise);

  DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
  const wallet = await TestNetWallet.named("mywallet");

  const balance = await wallet.getBalance();
  const getTokensResponse = await wallet.getAllTokenBalances();
  const arrayTokens = Object.keys(getTokensResponse);
  document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  document.querySelector('#tokenBalance').innerText = `${arrayTokens.length} different tokentypes`;

  wallet.watchBalance((balance) => {
    document.querySelector('#balance').innerText = `${balance.sat} testnet satoshis`;
  });
  const addr = await wallet.getDepositAddress();
  const tokenAddr = await wallet.getTokenDepositAddress();
  document.querySelector('#depositAddr').innerText = tokenAddr;

  const qr = await wallet.getTokenDepositQr();
  document.querySelector('#depositQr').src = qr.src;

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

})