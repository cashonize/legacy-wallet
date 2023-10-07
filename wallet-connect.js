import { encodeTransaction, generateTransaction, hash256, generateSigningSerializationBCH, SigningSerializationFlag, decodePrivateKeyWif, secp256k1, authenticationTemplateToCompilerBCH, importAuthenticationTemplate, authenticationTemplateP2pkhNonHd, lockingBytecodeToCashAddress, decodeAuthenticationInstructions, binToHex, hexToBin, decodeCashAddress, binsAreEqual, cashAddressToLockingBytecode, decodeTransaction } from "@bitauth/libauth";

const nameWallet = "mywallet";
let historyUpdateInterval;

let darkMode = false;
const readDarkMode = localStorage.getItem("darkMode");
if (readDarkMode === "true") darkMode = true;

document.getElementById("wc-session-approval-modal").onclick = (event) => {
  document.getElementById("wc-session-approval-modal").style.display = "none";
}

document.getElementById("wc-session-approval-modal-inner").onclick = (event) => {
  event.stopPropagation();
}

let html5QrcodeScanner;

document.getElementById("wc-session-scan-modal").onclick = async () => {
  document.getElementById("wc-session-scan-modal").style.display = "none";
  await html5QrcodeScanner?.clear();
}

document.getElementById("wc-session-scan-modal-inner").onclick = (event) => {
  event.stopPropagation();
}

document.getElementById("wc-session-history-modal").onclick = () => {
  document.getElementById("wc-session-history-modal").style.display = "none";
  clearInterval(historyUpdateInterval);
}

document.getElementById("wc-session-history-modal-inner").onclick = (event) => {
  event.stopPropagation();
}

// Sanitize a string to prevent XSS injection.
// NOTE: We should, in future, migrate to Sanitize API once it is well-supported across browsers:
//       https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API
const sanitize = (string) => {
  // If it is not a string, do nothing.
  if (typeof string !== 'string') {
    return string;
  }

  // Encode the string using encodeURI.
  const encoded = encodeURI(string);

  // Encode URI will encode spaces as '%20' - so let's restore these.
  const withSpacesRestored = encoded.replaceAll('%20', ' ');

  // Return the sanitized string.
  return withSpacesRestored;
}

const parseExtendedJson = (jsonString) => {
  const uint8ArrayRegex = /^<Uint8Array: 0x(?<hex>[0-9a-f]*)>$/u;
  const bigIntRegex = /^<bigint: (?<bigint>[0-9]*)n>$/;

  return JSON.parse(jsonString, (_key, value) => {
    if (typeof value === "string") {
      const bigintMatch = value.match(bigIntRegex);
      if (bigintMatch) {
        return BigInt(bigintMatch[1]);
      }
      const uint8ArrayMatch = value.match(uint8ArrayRegex);
      if (uint8ArrayMatch) {
        return hexToBin(uint8ArrayMatch[1]);
      }
    }
    return value;
  });
}

const satoshiToBCHString = (amount) => {
  const numberAmount = Number(amount);
  if (Math.abs(numberAmount / (10 ** 4)) > 1000) {
    const bchAmount = numberAmount * (10 ** -8)
    return `${bchAmount.toFixed(8)} BCH`
  } else {
    return `${numberAmount} sat`
  }
};

const setAutoApproveState = (topic, newState) => {
  const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");

  if (newState === undefined) {
    delete state[topic];
  } else {
    if (!state[topic]) {
      state[topic] = {};
    }

    if (newState?.requests) {
      state[topic].requests = newState.requests;
    }

    if (newState?.timestamp) {
      state[topic].timestamp = newState.timestamp;
    }
  }

  localStorage.setItem("auto-approve", JSON.stringify(state));
}

const toggleAutoApprove = (topic, enable) => {
  document.getElementById(`session-auto-requests-left`).innerHTML = `&infin; left`;
  document.getElementById(`session-auto-minutes-left`).innerHTML = `&infin;m left`;
  setAutoApproveState(topic, enable ? { requests: undefined, timestamp: undefined } : undefined);

  document.getElementById(`session-auto-requests`).value = "";
  document.getElementById(`session-auto-requests`).disabled = !enable;
  document.getElementById(`session-auto-minutes`).value = "";
  document.getElementById(`session-auto-minutes`).disabled = !enable;
  document.getElementById(`session-auto`).checked = enable;
}

const checkAutoApproveTimeAndUpdateCounters = (topic) => {
  const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
  document.getElementById(`session-auto-requests-left`).innerHTML = `${state?.[topic]?.requests === undefined ? '&infin;' : sanitize(state?.[topic]?.requests)} left`;
  if (state?.[topic]?.timestamp !== undefined) {
    const delta = state?.[topic]?.timestamp - new Date().getTime();
    if (delta < 0) {
      setAutoApproveState(topic, undefined);
      toggleAutoApprove(topic, false);
    } else {
      const minutes = new Date(delta).getMinutes();
      document.getElementById(`session-auto-minutes-left`).innerHTML = `${sanitize(minutes)}m left`;
    }
  } else {
    document.getElementById(`session-auto-minutes-left`).innerHTML = `${'&infin;'}m left`;
  }
};

const checkAutoApproveRequestsLeftAndUpdateCounters = (topic) => {
  const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
  if (state?.[topic]?.requests !== undefined) {
    state[topic].requests -= 1;
    setAutoApproveState(topic, { requests: state[topic].requests });

    if (state[topic].requests <= 0) {
      setTimeout(() => {
        setAutoApproveState(topic, undefined);
        toggleAutoApprove(topic, false);
      }, 0);
    } else {
      document.getElementById(`session-auto-requests-left`).innerHTML = `${sanitize(state?.[topic]?.requests)} left`;
    }
  } else {
    document.getElementById(`session-auto-requests-left`).innerHTML = `${'&infin;'} left`;
  }
};

import { Core, HISTORY_EVENTS } from '@walletconnect/core'
import { getSdkError } from '@walletconnect/utils';
import { Web3Wallet } from '@walletconnect/web3wallet'

const ready = async () => {
  return new Promise(async (resolve) => {
    let retries = 0;
    const interval = setInterval(async () => {
      retries++;
      if (retries > 50) {
        clearInterval(interval);
        resolve(false);
      }

      if (window.walletClass && await Wallet.namedExists(nameWallet)) {
        clearInterval(interval);
        resolve(true);
      }
    }, 50);
  });
};

const core = new Core({
  projectId: "3fd234b8e2cd0e1da4bc08a0011bbf64"
});

const initWalletConnect = async () => {
if (!await ready()) {
  return;
}

Web3Wallet.init({
  core,
  metadata: {
    name: 'Cashonize',
    description: 'Cashonize BitcoinCash Web Wallet',
    url: 'cashonize.com/',
    icons: ['https://cashonize.com/images/favicon.ico'],
  }
}).then(async (web3wallet) =>
{
  const updateProposal = (proposal) => {
    const proposalParent = document.getElementById("wc-session-approval");

    const meta = proposal.params.proposer.metadata;
    const peerName = meta.name;
    const approvalHtml = /* html */`
      <div id="proposal-${sanitize(proposal.id)}" style="display: flex; align-items: center; flex-direction: row; gap: 10px;">
        <div id="proposal-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${sanitize(meta.icons[0])}"></div>
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div id="proposal-app-name">${sanitize(peerName)}</div>
          <div id="proposal-app-url"><a href="${sanitize(meta.url)}" target="_blank">${sanitize(meta.url)}</a></div>
        </div>
      </div>`;
    proposalParent.innerHTML = approvalHtml;
  };

  const updateSessions = () => {
    const sessions = web3wallet.getActiveSessions();
    const keys = Object.keys(sessions).reverse();

    const sessionParent = document.getElementById("wc-sessions");
    sessionParent.innerHTML = "";
    keys.forEach((key, index) => {
      const session = sessions[key];
      const meta = session.peer.metadata;
      const peerName = meta.name + (keys.findIndex((val) =>
        sessions[val].peer.metadata.name === meta.name &&
        sessions[val].topic != session.topic) !== -1 ? ` - ${session.topic.slice(0, 6)}` : "");
      const sessionHtml = /* html */`
        <div id="session-${sanitize(session.topic)}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding: 7px; ${index % 2 === 0 ? "" : "background: azure"}">
          <div id="session-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${sanitize(meta.icons[0])}"></div>
          <div style="display: flex; flex-direction: column; width: 100%;">
            <div id="session-app-name">${sanitize(peerName)}</div>
            <div id="session-app-url"><a href="${sanitize(meta.url)}" target="_blank">${sanitize(meta.url)}</a></div>
            <div id="session-app-description">${sanitize(meta.description)}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div id="session-settings-${sanitize(session.topic)}" style="height: 24px; width: 24px; cursor: pointer;"><img class="settingsIcon icon ${darkMode? "dark":""}"></div>
            <div id="session-delete-${sanitize(session.topic)}" style="height: 24px; width: 24px; cursor: pointer;"><img class="trashIcon icon ${darkMode? "dark":""}"></div>
          </div>
        </div>`;
      sessionParent.innerHTML += sessionHtml;

      setTimeout(() => {
        document.getElementById(`session-delete-${session.topic}`).onclick = async () => {
          await web3wallet.disconnectSession({
            topic: session.topic,
            reason: getSdkError("USER_DISCONNECTED")
          });
          document.getElementById(`session-${session.topic}`).remove();
          const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
          delete state[session.topic];
          localStorage.setItem("auto-approve", JSON.stringify(state));
        };

        document.getElementById(`session-settings-${session.topic}`).onclick = async () => {
          document.getElementById("wc-session-history-modal").style.display = "flex";
          document.getElementById("wc-session-history-modal").dataset.topic = sanitize(session.topic);
          updateHistory();
        };
      }, 250);
    });
  }

  const updateHistory = async () => {
    const allowedMethods = ["bch_signTransaction", "bch_signMessage"];
    let history = core.history.values.filter(val => val.request.method === "wc_sessionRequest" && allowedMethods.includes(val.request?.params?.request?.method));
    const topic = document.getElementById("wc-session-history-modal").dataset.topic;
    if (topic) {
      history = history.filter(val => val.topic === topic);
    } else {
      return;
    }

    const wallet = await walletClass.named(nameWallet);
    const signingAddress = wallet.getDepositAddress();
    const signingLockingBytecode = cashAddressToLockingBytecode(signingAddress).bytecode;

    const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
    document.getElementById(`session-auto`).checked = !!state[topic];
    document.getElementById(`session-auto`).onclick = async (event) => {
      toggleAutoApprove(topic, event.target.checked);
    };
    document.getElementById(`session-auto-requests`).onchange = (event) => {
      document.getElementById(`session-auto-requests-left`).innerHTML = `${sanitize(event.target.value)} left`;
      setAutoApproveState(topic, { requests: parseInt(event.target.value) });
    }

    document.getElementById(`session-auto-minutes`).onchange = (event) => {
      const minutes = parseInt(event.target.value);
      const timestamp = new Date().getTime() + minutes * 60000;
      document.getElementById(`session-auto-minutes-left`).innerHTML = `${sanitize(minutes)}m left`;
      setAutoApproveState(topic, { timestamp: timestamp });
    }

    checkAutoApproveTimeAndUpdateCounters(topic);

    clearInterval(historyUpdateInterval);
    historyUpdateInterval = setInterval(() => checkAutoApproveTimeAndUpdateCounters(topic), 60 * 1000);

    const historyParent = document.getElementById("wc-history");
    historyParent.innerHTML = "";
    if (history.length === 0) {
      historyParent.innerHTML =
        /* html */ `<div style="display: flex; justify-content: center; margin-top: 2rem;">No activity yet<div>`;
    } else {
      history.reverse().forEach((item, index) => {
        let historyHtml;
        if (item.request.params?.request?.method === "bch_signMessage") {
          const response = item.response?.error ? { title: "Error:", text: item.response.error.message } :
                     item.response?.result ? { title: "Result:", text: item.response.result } :
                     { title: "Response:", text: "No response." };

          historyHtml = /* html */`
            <div id="history-${sanitize(item.id)}" class="history-item" style="display: flex; align-items: center; flex-direction: row; gap: 10px; ${index % 2 === 0 ? "" : "background: ghostwhite"}">
              <div style="display: flex; flex-direction: column; width: 100%; gap: 0.5rem">
                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem;">
                  <div style="color: rgb(107 114 128); width: 75px;">Date:</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${sanitize(new Date(item.id / 1000).toUTCString())}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Request:</div>
                  <div class="history-value">${sanitize(item.request.params?.request?.method)}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Address:</div>
                  <div class="history-value-address" style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row;"><div class="prefix-span">${sanitize(walletClass.networkPrefix)}:</div><div style="overflow-x: hidden; text-overflow: ellipsis;">${sanitize(item.request.params?.request?.params?.address.split(":")[1])}</div></div>
                  <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(item.request.params?.request?.params?.address)}')">
                    <img class="copyIcon icon" src="/images/copy.svg">
                  </button>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Message:</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${sanitize(item.request.params?.request?.params?.message)}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">${sanitize(response.title)}</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${sanitize(response.text)}</div>
                </div>
              </div>
            </div>`;
        } else if (item.request.params?.request?.method === "bch_signTransaction") {
          const response = item.response?.error ? { title: "Error:", text: item.response.error.message } :
            item.response?.result ? { title: "Result:", text: item.response.result.signedTransaction } :
            { title: "Response:", text: "No response." };

          const params = parseExtendedJson(JSON.stringify(item.request.params?.request?.params))
          // item.request.params.request.params = parseExtendedJson(JSON.stringify(item.request.params?.request?.params));

          const userPromptHtml = params.userPrompt ? /* html */ `
            <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
              <div style="color: rgb(107 114 128); width: 75px;">Prompt:</div>
              <div class="history-value">${sanitize(item.request.params?.request?.params?.userPrompt)}</div>
            </div>` : "";

          const sourceOutputsUnpacked = params.sourceOutputs;
          const valueIn = sourceOutputsUnpacked.reduce((prev, curr) => prev + (binsAreEqual(signingLockingBytecode, curr.lockingBytecode) ? curr.valueSatoshis : 0n), 0n);
          const valueOut = params.transaction.outputs.reduce((prev, curr) => prev + (binsAreEqual(signingLockingBytecode, curr.lockingBytecode) ? curr.valueSatoshis : 0n), 0n);
          const valueTransfer = valueIn - valueOut;
          sourceOutputsUnpacked.forEach((input, index) => {
            const contractName = sourceOutputsUnpacked[index].contract?.artifact?.contractName;

            if (contractName) {
              return;
            }

            // let us look at the inputs
            const decoded = decodeAuthenticationInstructions(input.unlockingBytecode);
            const redeemScript = (
              decoded.splice(-1)[0]
            )?.data;
            if (redeemScript?.length) {
              // if input is a contract interaction, let's lookup the contract map and update UI
              // let's remove any contract constructor parameters 1 by 1 to get to the contract body
              let script = redeemScript.slice();
              let artifact = artifactMap[binToHex(script)];
              while (!artifact) {
                const decodedScript = decodeAuthenticationInstructions(script);
                const [{ opcode }] = decodedScript.splice(0,1);
                // if the opcode is a data push, we strip it and continue
                if (opcode <= 96 /* OP_16 */) {
                  script = encodeAuthenticationInstructions(decodedScript);
                  artifact = artifactMap[binToHex(script)];
                } else {
                  return;
                }
              }

              let abiFunction;
              if (artifact.abi.length > 1) {
                // expect to N abi parameters + 1 function index push
                const abiFunctionIndex = Number(vmNumberToBigInt((decoded.splice(-1)[0]).data));
                abiFunction = artifact.abi[abiFunctionIndex];
              } else {
                abiFunction = artifact.abi[0];
              }
              input.contract = {
                ...input.contract,
                artifact: {
                  contractName: artifact.contractName
                },
                abiFunction: {
                  name: abiFunction.name,
                  inputs: undefined
                },
                redeemScript: undefined
              }
            }
          });

          const firstContract = sourceOutputsUnpacked.find(val => val.contract?.artifact?.contractName)?.contract;
          const contractHtml = firstContract ? /* html */ `
            <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
              <div style="color: rgb(107 114 128); width: 75px;">Contract:</div>
              <div class="history-value">${sanitize(firstContract.artifact.contractName)} - ${sanitize(firstContract.abiFunction?.name)}</div>
            </div>` : "";

          const copyHtml = response.title === "Result:" ? /* html */ `
            <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(response.text)}')">
              <img class="copyIcon icon" src="/images/copy.svg">
            </button>` : "";

          const valueHtml = /* html */ `
            <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
              <div style="color: rgb(107 114 128); width: 75px;">Cost:</div>
              <div class="history-value">${sanitize(satoshiToBCHString(valueTransfer))}</div>
            </div>`;

          // const inputValue = sourceOutputsUnpacked.reduce(val => val)
          historyHtml = /* html */`
          <div id="history-${sanitize(item.id)}" class="history-item" style="display: flex; align-items: center; flex-direction: row; gap: 10px; ${index % 2 === 0 ? "" : "background: ghostwhite"}">
            <div style="display: flex; flex-direction: column; width: 100%; gap: 0.5rem">
              <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem;">
                <div style="color: rgb(107 114 128); width: 75px;">Date:</div>
                <div class="history-value" style="overflow-wrap: break-word;">${sanitize(new Date(item.id / 1000).toUTCString())}</div>
              </div>

              <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                <div style="color: rgb(107 114 128); width: 75px;">Request:</div>
                <div class="history-value">${sanitize(item.request.params?.request?.method)}</div>
              </div>

              ${userPromptHtml}

              ${contractHtml}

              ${valueHtml}

              <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                <div style="color: rgb(107 114 128); width: 75px;">${sanitize(response.title)}</div>
                <div class="history-value" style="overflow-wrap: break-word;">${sanitize(response.text.length > 20 ? response.text.slice(0, 20) + "..." : response.text)}${copyHtml}</div>
              </div>
            </div>
        </div>`;
        }

        historyParent.innerHTML += historyHtml;
      });
    }
  }

  updateSessions();
  updateHistory();

  core.history.on(HISTORY_EVENTS.created, updateHistory);
  core.history.on(HISTORY_EVENTS.updated, updateHistory);

  const renderSessionProposal = async (sessionProposal) => {
    const { requiredNamespaces } = sessionProposal.params;

    if (!requiredNamespaces.bch) {
      alert(`You are trying to connect an app from unsupported blockchain(s): ${Object.keys(requiredNamespaces).join(", ")}`);
      return;
    }

    const requiredNetworkPrefix = requiredNamespaces.bch.chains[0]?.split(":")[1];
    let needsNetworkSwitch = false;
    if (walletClass.networkPrefix !== requiredNetworkPrefix) {
      needsNetworkSwitch = true;
      const requiredNetworkFullName = requiredNetworkPrefix === "bchtest" ? "BCH Chipnet" : "BCH Mainnet";
      document.getElementById("session-approve-button").value = `Switch to ${requiredNetworkFullName} and approve`;
    }

    document.getElementById("session-approve-button").onclick = async () => {
      if (needsNetworkSwitch) {
        const networkName = requiredNetworkPrefix === "bchtest" ? "chipnet" : "mainnet";
        changeNetwork({ target: { value: networkName } });
        changeView(4);
      }

      const wallet = await walletClass.named(nameWallet);
      const namespaces = {
        bch: {
          methods: [
            "bch_getAddresses",
            "bch_signTransaction",
            "bch_signMessage"
          ],
          chains: walletClass.network === "testnet" ? ["bch:bchtest"] : ["bch:bitcoincash"],
          events: [
            "addressesChanged"
          ],
          accounts: [`bch:${wallet.getDepositAddress()}`],
        }
      }

      await web3wallet.approveSession({
        id: sessionProposal.id,
        namespaces: namespaces,
      });
      document.getElementById("wc-session-approval-modal").style.display = "none";

      updateSessions();
      updateHistory();
    };

    document.getElementById("session-reject-button").onclick = async () => {
      await web3wallet.rejectSession({
        id: sessionProposal.id,
        reason: getSdkError('USER_REJECTED'),
      });
      document.getElementById("wc-session-approval-modal").style.display = "none";

      updateSessions();
      updateHistory();
    };

    updateProposal(sessionProposal);
    updateSessions();
    updateHistory();

    document.getElementById("wc-session-approval-modal").style.display = "flex";
  }

  const renderSessionProposals = async () => {
    const getPendingSessionProposals = web3wallet.getPendingSessionProposals();
    for (const proposal of getPendingSessionProposals) {
      renderSessionProposal({ id: proposal.id, params: proposal });
    }
  }

  web3wallet.on('session_proposal', renderSessionProposal);

  web3wallet.on('session_delete', async params => {
    updateSessions();
    updateHistory();
  });

  const connectButton = document.getElementById("connect-button");
  connectButton.onclick = async () => {
    try {
      const uri = document.getElementById("wcUri").value;
      if (!uri) {
        throw new Error("Please paste valid Wallet Connect V2 connection URI");
      }
      await web3wallet.core.pairing.pair({ uri });
      document.getElementById("wcUri").value = "";
    } catch (err) {
      alert(`Error connecting with dApp:\n${err.mesage ?? err}`);
    } finally {
      connectButton.disabled = false;
    }
  };

  const scanButton = document.getElementById("scan-button");
  scanButton.onclick = async () => {
    document.getElementById("wc-session-scan-modal").style.display = "flex";
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 3, qrbox: {width: 250, height: 250},
        formatsToSupport: [0]
      },
      /* verbose= */ false);
    html5QrcodeScanner.render(async (decodedText) => {
      document.getElementById("wc-session-scan-modal").style.display = "none";
      await html5QrcodeScanner?.clear();
      document.getElementById("wcUri").value = decodedText;
      connectButton.click();
    }, () => {});
  }

  web3wallet.on('session_request', async event => {
    renderRequests();
  });

  const renderRequests = () => {
    const requestParent = document.getElementById("wc-session-request-modal-container");
    requestParent.innerHTML = "";
    const pendingRequests = web3wallet.getPendingSessionRequests();
    for (const request of pendingRequests) {
      renderRequest(request);
    }
  };

  const renderRequest = async (event) => {
    const wallet = await walletClass.named(nameWallet);

    const { topic, params, id } = event
    const { request } = params
    const method = request.method;

    let result;
    let error;

    const whitelistMethods = ["bch_getAddresses", "bch_getAccounts"];
    let autoApprove = whitelistMethods.includes(method);
    if (!autoApprove) {
      checkAutoApproveTimeAndUpdateCounters(topic);
      checkAutoApproveRequestsLeftAndUpdateCounters(topic);
    }

    const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
    autoApprove = !!state[topic]

    const walletAddress = wallet.getDepositAddress();
    switch (method) {
      case "bch_getAddresses":
      case "bch_getAccounts":
        {
          result = [walletAddress];
          const response = { id, jsonrpc: '2.0', result };
          await web3wallet.respondSessionRequest({ topic, response });
        }

        break;
      case "bch_signMessage":
      case "personal_sign": {
        const signingAddress = request.params?.address ?? request.params?.account;
        if (!signingAddress) {
          error = {code: -1, message: "Signing address not defined"};
          break;
        }
        if (signingAddress !== walletAddress) {
          error = {code: -1, message: "Signing address does not belong to this wallet"};
          break;
        }
        const message = request.params?.message;
        if (message === undefined) {
          error = {code: -1, message: "Message parameter is mandatory"};
          break;
        }

        if (error) {
          const response = { id, jsonrpc: '2.0', error };
          await web3wallet.respondSessionRequest({ topic, response });
          return;
        }


        if (autoApprove) {
          const signedMessage = await wallet.sign(message);
          const response = { id, jsonrpc: '2.0', result: signedMessage.signature };
          await web3wallet.respondSessionRequest({ topic, response });
        } else {
          const sessions = web3wallet.getActiveSessions();
          const keys = Object.keys(sessions);
          const session = sessions[topic];
          if (!session) {
            return;
          }
          const meta = session.peer.metadata;
          const peerName = meta.name + (keys.findIndex((val) =>
            sessions[val].peer.metadata.name === meta.name &&
            sessions[val].topic != session.topic) !== -1 ? ` - ${session.topic.slice(0, 6)}` : "");

          const requestHtml = /* html */ `<fieldset id="wc-session-request-modal-inner-${sanitize(id)}" style="padding: 3rem; width: 510px; overflow-y: scroll; max-height: 90vh;">
            <legend style="font-size: larger;">Sign Message</legend>
            <div id="wc-request">
              <div style="display: flex; justify-content: center; font-size: larger;">Sign this test message</div>
                <div style="font-size: large; margin-top: 2rem;">Origin:</div>
                <div id="session-${sanitize(session.topic)}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding: 7px;">
                  <div id="session-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${sanitize(meta.icons[0])}"></div>
                  <div style="display: flex; flex-direction: column; width: 100%;">
                    <div id="session-app-name">${sanitize(peerName)}</div>
                    <div id="session-app-url" style="overflow-wrap: anywhere;"><a href="${sanitize(meta.url)}" target="_blank">${sanitize(meta.url)}</a></div>
                  </div>
                </div>
                <div style="font-size: large; margin-top: 2rem;">Signer:</div>
                <div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
                  <div style="font-size: smaller;" class="prefix-span">${sanitize(walletClass.networkPrefix)}:</div>
                  <div style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">${sanitize(signingAddress.split(":")[1])}</div>
                  <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(signingAddress)}')">
                    <img class="copyIcon icon" src="/images/copy.svg">
                  </button>
                </div>
                <div style="font-size: large; margin-top: 2rem;">Message:</div>
                <div style="overflow-wrap: anywhere; font-size: smaller;">${sanitize(message)}</div>
              <hr style="margin-top: 3rem;" />
              <div style="display: flex; justify-content: center; margin-top: 1rem; margin-bottom: 2rem;">
                <input id="request-approve-button-${sanitize(id)}" style="width: 111px;" class="button primary" type="button" value="Sign">
                <input id="request-reject-button-${sanitize(id)}" style="width: 111px;" class="button" type="button" value="Cancel">
              </div>
            </div>
          </fieldset>`

          const requestParent = document.getElementById("wc-session-request-modal-container");
          requestParent.style.display = "flex";
          requestParent.innerHTML += requestHtml;

          setTimeout(() => {
            document.getElementById(`request-approve-button-${id}`).onclick = async () => {
              const signedMessage = await wallet.sign(message);
              const response = { id, jsonrpc: '2.0', result: signedMessage.signature };
              await web3wallet.respondSessionRequest({ topic, response });

              document.getElementById(`wc-session-request-modal-inner-${id}`).remove();
              if (requestParent.children.length === 0) {
                requestParent.style.display = "none";
              }
            };

            document.getElementById(`request-reject-button-${id}`).onclick = async () => {
              const response = { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') };
              await web3wallet.respondSessionRequest({ topic, response });

              document.getElementById(`wc-session-request-modal-inner-${id}`).remove();
              if (requestParent.children.length === 0) {
                requestParent.style.display = "none";
              }
            };
          }, 250);
        }
      }
        break;
      case "bch_signTransaction": {
        const params = parseExtendedJson(JSON.stringify(request.params));

        if (typeof params.transaction === "string") {
          params.transaction = decodeTransaction(hexToBin(params.transaction));
        }

        const tx = params.transaction;
        const sourceOutputsUnpacked = params.sourceOutputs;

        const toCashaddr = (lockingBytecode) => {
          const result = lockingBytecodeToCashAddress(lockingBytecode, walletClass.networkPrefix);
          if (typeof result !== "string") {
            throw result;
          }
          return result;
        }

        const wallet = await walletClass.named("mywallet");
        const signingAddress = wallet.getDepositAddress();

        // contract lookup map, allows to figure out the contract name and function name
        const artifactMap = {};

        sourceOutputsUnpacked.forEach((input, index) => {
          const contractName = sourceOutputsUnpacked[index].contract?.artifact?.contractName;

          if (contractName) {
            return;
          }

          // let us look at the inputs
          const decoded = decodeAuthenticationInstructions(input.unlockingBytecode);
          const redeemScript = (
            decoded.splice(-1)[0]
          )?.data;
          if (redeemScript?.length) {
            // if input is a contract interaction, let's lookup the contract map and update UI
            // let's remove any contract constructor parameters 1 by 1 to get to the contract body
            let script = redeemScript.slice();
            let artifact = artifactMap[binToHex(script)];
            while (!artifact) {
              const decodedScript = decodeAuthenticationInstructions(script);
              const [{ opcode }] = decodedScript.splice(0,1);
              // if the opcode is a data push, we strip it and continue
              if (opcode <= 96 /* OP_16 */) {
                script = encodeAuthenticationInstructions(decodedScript);
                artifact = artifactMap[binToHex(script)];
              } else {
                return;
              }
            }

            let abiFunction;
            if (artifact.abi.length > 1) {
              // expect to N abi parameters + 1 function index push
              const abiFunctionIndex = Number(vmNumberToBigInt((decoded.splice(-1)[0]).data));
              abiFunction = artifact.abi[abiFunctionIndex];
            } else {
              abiFunction = artifact.abi[0];
            }
            input.contract = {
              ...input.contract,
              artifact: {
                contractName: artifact.contractName
              },
              abiFunction: {
                name: abiFunction.name,
                inputs: undefined
              },
              redeemScript: undefined
            }
          }
        });

        const sign = async () => {
          // prepare libauth template for input signing
          const template = importAuthenticationTemplate(
            authenticationTemplateP2pkhNonHd
          );
          if (typeof template === "string") {
            throw new Error("Transaction template error");
          }

          // configure compiler
          const compiler = authenticationTemplateToCompilerBCH(template);

          const txTemplate = {...tx};

          // decode private key for current signer
          const privateKeyWif = wallet.privateKeyWif;
          const decodeResult = decodePrivateKeyWif(privateKeyWif);
          if (typeof decodeResult === "string") {
            alert("Not enough information provided, please include contract redeemScript");
            return;
          }
          const privateKey = decodeResult.privateKey;
          const pubkeyCompressed = secp256k1.derivePublicKeyCompressed(privateKey);
          if (typeof pubkeyCompressed === "string") {
            alert(pubkeyCompressed);
            return;
          }

          for (const [index, input] of txTemplate.inputs.entries()) {
            if (sourceOutputsUnpacked[index].contract?.artifact.contractName) {
              // instruct compiler to produce signatures for relevant contract inputs

              // replace pubkey and sig placeholders
              let unlockingBytecodeHex = binToHex(sourceOutputsUnpacked[index].unlockingBytecode);
              const sigPlaceholder = "41" + binToHex(Uint8Array.from(Array(65)));
              const pubkeyPlaceholder = "21" + binToHex(Uint8Array.from(Array(33)));
              if (unlockingBytecodeHex.indexOf(sigPlaceholder) !== -1) {
                // compute the signature argument
                const hashType = SigningSerializationFlag.allOutputs | SigningSerializationFlag.utxos | SigningSerializationFlag.forkId;
                const context = { inputIndex: index, sourceOutputs: sourceOutputsUnpacked, transaction: tx };
                const signingSerializationType = new Uint8Array([hashType]);

                const coveredBytecode = sourceOutputsUnpacked[index].contract?.redeemScript;
                if (!coveredBytecode) {
                  alert("Not enough information provided, please include contract redeemScript");
                  return;
                }
                const sighashPreimage = generateSigningSerializationBCH(context, { coveredBytecode, signingSerializationType });
                const sighash = hash256(sighashPreimage);
                const signature = secp256k1.signMessageHashSchnorr(privateKey, sighash);
                if (typeof signature === "string") {
                  alert(signature);
                  return;
                }
                const sig = Uint8Array.from([...signature, hashType]);

                unlockingBytecodeHex = unlockingBytecodeHex.replace(sigPlaceholder, "41" + binToHex(sig));
              }
              if (unlockingBytecodeHex.indexOf(pubkeyPlaceholder) !== -1) {
                unlockingBytecodeHex = unlockingBytecodeHex.replace(pubkeyPlaceholder, "21" + binToHex(pubkeyCompressed));
              }

              input.unlockingBytecode = hexToBin(unlockingBytecodeHex);
            } else {
              // replace unlocking bytecode for non-contract inputs having placeholder unlocking bytecode
              const sourceOutput = sourceOutputsUnpacked[index];
              if (!sourceOutput.unlockingBytecode?.length && toCashaddr(sourceOutput.lockingBytecode) === signingAddress) {
                input.unlockingBytecode = {
                  compiler,
                  data: {
                    keys: { privateKeys: { key: privateKey } },
                  },
                  valueSatoshis: sourceOutput.valueSatoshis,
                  script: "unlock",
                  token: sourceOutput.token,
                }
              }
            }
          };

          // generate and encode transaction
          const generated = generateTransaction(txTemplate);
          if (!generated.success) {
            throw Error(JSON.stringify(generated.errors, null, 2));
          }

          const encoded = encodeTransaction(generated.transaction);
          const hash = binToHex(sha256.hash(sha256.hash(encoded)).reverse());
          return { signedTransaction: binToHex(encoded), signedTransactionHash: hash };
        };

        if (autoApprove) {
          const result = await sign();
          const response = { id, jsonrpc: '2.0', result };
          await web3wallet.respondSessionRequest({ topic, response });

          break;
        }

        // UI relevant part
        const parsedOpReturn = (bytecode) => {
          const decoded = decodeAuthenticationInstructions(bytecode);
          return (decoded.slice(1)).map(val => "0x" + binToHex(val.data))
        }

        const sessions = web3wallet.getActiveSessions();
        const keys = Object.keys(sessions);
        const session = sessions[topic];
        if (!session) {
          return;
        }
        const meta = session.peer.metadata;
        const peerName = meta.name + (keys.findIndex((val) =>
          sessions[val].peer.metadata.name === meta.name &&
          sessions[val].topic != session.topic) !== -1 ? ` - ${session.topic.slice(0, 6)}` : "");

        const inputsHtml = sourceOutputsUnpacked.map((input, idx) => {
          const address = toCashaddr(input.lockingBytecode);
          const addressHtml = /* html */ `<div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
            <div style="font-size: smaller;" class="prefix-span">${sanitize(walletClass.networkPrefix)}:</div>
            <div style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">${sanitize(address.split(":")[1])}</div>
            <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(address)}')">
              <img class="copyIcon icon" src="/images/copy.svg">
            </button>
          </div>`;


          const tokenHtml = input.token ? /* html */ `<span>
            <br/>
            <hr/>
            Token: <span style="background-color: #${sanitize(binToHex(input.token.category.slice(0, 3)))}">${sanitize(binToHex(input.token.category.slice(0, 3)))}<br/></span>
            ${input.token?.nft?.commitment.length ? `<span> Commitment: ${sanitize(binToHex(input.token.nft.commitment))} <br/></span>` : ""}
            ${input.token?.nft?.capability ? `<span> Capability: ${sanitize(input.token.nft.capability)} <br/></span>` : ""}
            ${input.token?.amount > 0n ? `<span> Fungible amount: ${sanitize(input.token.amount)} <br/></span>` : ""}
          </span>` : "";
          const contractHtml = input.contract?.artifact.contractName ? /* html */ `<span>
            <hr/>
            Contract: ${ sanitize(input.contract?.artifact.contractName) } <br/>
            Function: ${ sanitize(input.contract?.abiFunction.name) } <br/>
          </span>` : "";
          return /* html */`<div style="margin-top: 1rem;"><span style="font-weight: 500; margin-right: 0.5rem;">#${sanitize(idx)}:</span>${sanitize(satoshiToBCHString(input.valueSatoshis))} (${sanitize(binToHex(input.outpointTransactionHash).slice(0,4))}...${sanitize(binToHex(input.outpointTransactionHash).slice(-4))}:${sanitize(input.outpointIndex)}) ${addressHtml}${tokenHtml}${contractHtml}</div>`
        }).join("");

        const outputsHtml = tx.outputs.map((output, idx) => {
          if (output.lockingBytecode[0] === 106) {
            const chunks = parsedOpReturn(output.lockingBytecode).map((chunk) => `<span>${ sanitize(chunk) }<br/></span>`).join("");
            return /* html */ `<div style="margin-top: 1rem; max-width: 300px;"><span style="font-weight: 500; margin-right: 0.5rem;">#${sanitize(idx)}:</span>
              OP_RETURN<br/>
              ${chunks}
            </div>`;
          }

          const address = toCashaddr(output.lockingBytecode);
          const addressHtml = /* html */ `<div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
            <div style="font-size: smaller;" class="prefix-span">${sanitize(walletClass.networkPrefix)}:</div>
            <div style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">${sanitize(address.split(":")[1])}</div>
            <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(address)}')">
              <img class="copyIcon icon" src="/images/copy.svg">
            </button>
          </div>`;

          const tokenHtml = output.token ? /* html */ `<span>
            <br/>
            <hr/>
            Token: <span style="background-color: #${sanitize(binToHex(output.token.category.slice(0, 3)))}">${sanitize(binToHex(output.token.category.slice(0, 3)))}<br/></span>
            ${output.token?.nft?.commitment.length ? `<span> Commitment: ${sanitize(binToHex(output.token.nft.commitment))} <br/></span>` : ""}
            ${output.token?.nft?.capability ? `<span> Capability: ${sanitize(output.token.nft.capability)} <br/></span>` : ""}
            ${output.token?.amount > 0n ? `<span> Fungible amount: ${sanitize(output.token.amount)} <br/></span>` : ""}
          </span>` : "";

          return /* html */ `<div style="margin-top: 1rem;"><span style="font-weight: 500; margin-right: 0.5rem;">#${sanitize(idx)}:</span>${sanitize(satoshiToBCHString(output.valueSatoshis))} ${addressHtml}${tokenHtml}`;
        }).join("");

        const requestHtml = /* html */ `<fieldset id="wc-session-request-modal-inner-${sanitize(id)}" style="width: 510px; overflow-y: scroll; max-height: 90vh;">
          <legend style="font-size: larger;">Sign Transaction</legend>
          <div id="wc-request">
            <div style="display: flex; justify-content: center; font-size: larger;">${sanitize(params.userPrompt)}</div>
              <div style="font-size: large; margin-top: 2rem;">Origin:</div>
              <div id="session-${sanitize(session.topic)}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding: 7px;">
                <div id="session-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${sanitize(meta.icons[0])}"></div>
                <div style="display: flex; flex-direction: column; width: 100%;">
                  <div id="session-app-name">${sanitize(peerName)}</div>
                  <div id="session-app-url" style="overflow-wrap: anywhere;"><a href="${sanitize(meta.url)}" target="_blank">${sanitize(meta.url)}</a></div>
                </div>
              </div>
              <div style="font-size: large; margin-top: 2rem;">Signer:</div>
              <div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
                <div style="font-size: smaller;" class="prefix-span">${sanitize(walletClass.networkPrefix)}:</div>
                <div style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">${sanitize(signingAddress.split(":")[1])}</div>
                <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText('${sanitize(signingAddress)}')">
                  <img class="copyIcon icon" src="/images/copy.svg">
                </button>
              </div>
              <div style="font-size: large; margin-top: 2rem;">Inputs:</div>
              ${inputsHtml}
              <div style="font-size: large; margin-top: 2rem;">Outputs:</div>
              ${outputsHtml}
            <hr style="margin-top: 3rem;" />
            <div style="display: flex; justify-content: center; margin-top: 1rem; margin-bottom: 2rem;">
              <input id="request-approve-button-${sanitize(id)}" style="width: 111px;" class="button primary" type="button" value="Sign">
              <input id="request-reject-button-${sanitize(id)}" style="width: 111px;" class="button" type="button" value="Cancel">
            </div>
          </div>
        </fieldset>`

        const requestParent = document.getElementById("wc-session-request-modal-container");
        requestParent.style.display = "flex";
        requestParent.innerHTML += requestHtml;

        setTimeout(() => {
          document.getElementById(`request-approve-button-${id}`).onclick = async () => {
            const result = await sign();
            const response = { id, jsonrpc: '2.0', result };
            if (params.broadcast) {
              await wallet.submitTransaction(hexToBin(result.signedTransaction));
            }
            await web3wallet.respondSessionRequest({ topic, response });

            document.getElementById(`wc-session-request-modal-inner-${id}`).remove();
            if (requestParent.children.length === 0) {
              requestParent.style.display = "none";
            }
          };

          document.getElementById(`request-reject-button-${id}`).onclick = async () => {
            const response = { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') };
            await web3wallet.respondSessionRequest({ topic, response });

            document.getElementById(`wc-session-request-modal-inner-${id}`).remove();
            if (requestParent.children.length === 0) {
              requestParent.style.display = "none";
            }
          };
        }, 250);
      }
        break;
      default:
        {
          const response = { id, jsonrpc: '2.0', error: {code: 1001, message: `Unsupported method ${method}`} };
          await web3wallet.respondSessionRequest({ topic, response });
        }
    }
  }

  renderSessionProposals();
  renderRequests();

  const wcuri = new URL(window.location.href.replace("#", "")).searchParams.get("uri");
  if (wcuri && wcuri.indexOf("wc:") === 0) {
    const pairings = web3wallet.core.pairing.pairings.getAll();
    const topic = wcuri.match(/^wc:([a-zA-Z0-9]+).*/)?.[1];
    if (pairings.some(val => val.topic === topic)) {
      // skip
    } else {
      document.getElementById("wcUri").value = wcuri;
      setTimeout(connectButton.onclick(), 250);
      window.history.replaceState(null, "Cashonize", "/");
      document.getElementById("view4").click();
    }
  }
});
};

window.initWalletConnect = initWalletConnect;
initWalletConnect();
