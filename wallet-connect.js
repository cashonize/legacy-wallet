const nameWallet = "mywallet";
let historyUpdateInterval;

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
  document.getElementById(`session-auto-requests-left`).innerHTML = `${state?.[topic]?.requests === undefined ? '&infin;' : state?.[topic]?.requests} left`;
  if (state?.[topic]?.timestamp !== undefined) {
    const delta = state?.[topic]?.timestamp - new Date().getTime();
    if (delta < 0) {
      setAutoApproveState(topic, undefined);
      toggleAutoApprove(topic, false);
    } else {
      const minutes = new Date(delta).getMinutes();
      document.getElementById(`session-auto-minutes-left`).innerHTML = `${minutes}m left`;
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
      document.getElementById(`session-auto-requests-left`).innerHTML = `${state?.[topic]?.requests} left`;
    }
  } else {
    document.getElementById(`session-auto-requests-left`).innerHTML = `${'&infin;'} left`;
  }
};

import { Core, HISTORY_EVENTS } from '@walletconnect/core'
import { getSdkError } from '@walletconnect/utils';
import { Web3Wallet } from '@walletconnect/web3wallet'

const core = new Core({
  projectId: "3fd234b8e2cd0e1da4bc08a0011bbf64"
})

Web3Wallet.init({
  core,
  metadata: {
    name: 'Cashonize',
    description: 'Cashonize BitcoinCash Web Wallet',
    url: 'cashonize.com/',
    icons: ['https://cashonize.com/images/favicon.png'],
  }
}).then((web3wallet) =>
{
  const updateProposal = (proposal) => {
    const proposalParent = document.getElementById("wc-session-approval");

    const meta = proposal.params.proposer.metadata;
    const peerName = meta.name;
    const approvalHtml = /* html */`
      <div id="proposal-${proposal.id}" style="display: flex; align-items: center; flex-direction: row; gap: 10px;">
        <div id="proposal-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${meta.icons[0]}"></div>
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div id="proposal-app-name">${peerName}</div>
          <div id="proposal-app-url"><a href="${meta.url}" target="_blank">${meta.url}</a></div>
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
        <div id="session-${session.topic}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding: 7px; ${index % 2 === 0 ? "" : "background: azure"}">
          <div id="session-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${meta.icons[0]}"></div>
          <div style="display: flex; flex-direction: column; width: 100%;">
            <div id="session-app-name">${peerName}</div>
            <div id="session-app-url"><a href="${meta.url}" target="_blank">${meta.url}</a></div>
            <div id="session-app-description">${meta.description}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div id="session-settings-${session.topic}" style="height: 24px; width: 24px; cursor: pointer;"><img class="cogIcon icon"></div>
            <div id="session-delete-${session.topic}" style="height: 24px; width: 24px; cursor: pointer;"><img class="trashIcon icon"></div>
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
          document.getElementById("wc-session-history-modal").dataset.topic = session.topic;
          updateHistory();
        };
      }, 250);
    });
  }

  const updateHistory = () => {
    const allowedMethods = ["bch_signTransaction", "bch_signMessage"];
    let history = core.history.values.filter(val => val.request.method === "wc_sessionRequest" && allowedMethods.includes(val.request?.params?.request?.method));
    const topic = document.getElementById("wc-session-history-modal").dataset.topic;
    if (topic) {
      history = history.filter(val => val.topic === topic);
    } else {
      return;
    }

    const state = JSON.parse(localStorage.getItem("auto-approve") || "{}");
    document.getElementById(`session-auto`).checked = !!state[topic];
    document.getElementById(`session-auto`).onclick = async (event) => {
      toggleAutoApprove(topic, event.target.checked);
    };
    document.getElementById(`session-auto-requests`).onchange = (event) => {
      document.getElementById(`session-auto-requests-left`).innerHTML = `${event.target.value} left`;
      setAutoApproveState(topic, { requests: parseInt(event.target.value) });
    }

    document.getElementById(`session-auto-minutes`).onchange = (event) => {
      const minutes = parseInt(event.target.value);
      const timestamp = new Date().getTime() + minutes * 60000;
      document.getElementById(`session-auto-minutes-left`).innerHTML = `${minutes}m left`;
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
                     { title: "Response:", text: "No response" };

          historyHtml = /* html */`
            <div id="history-${item.id}" class="history-item" style="display: flex; align-items: center; flex-direction: row; gap: 10px; ${index % 2 === 0 ? "" : "background: ghostwhite"}">
              <div style="display: flex; flex-direction: column; width: 100%; gap: 0.5rem">
                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem;">
                  <div style="color: rgb(107 114 128); width: 75px;">Date:</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${new Date(item.id / 1000).toUTCString()}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Request:</div>
                  <div class="history-value">${item.request.params?.request?.method}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Address:</div>
                  <div class="history-value-address" style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row;"><div class="prefix-span">bitcoincash:</div><div style="overflow-x: hidden; text-overflow: ellipsis;">${item.request.params?.request?.params?.address.split(":")[1]}</div></div>
                  <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText(${item.request.params?.request?.params?.address})">
                    <img class="copyIcon icon" src="/images/copy.svg">
                  </button>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Message:</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${item.request.params?.request?.params?.message}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">${response.title}</div>
                  <div class="history-value" style="overflow-wrap: break-word;">${response.text}</div>
                </div>
              </div>
            </div>`;
        } else if (item.request.params?.request?.method === "bch_signTransaction") {
          historyHtml = /* html */`
            <div id="history-${item.id}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding:7px; ${index % 2 === 0 ? "" : "background: ghostwhite"}">
              <div style="display: flex; flex-direction: column; width: 100%; gap: 0.5rem">
                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem;">
                  <div style="color: rgb(107 114 128); width: 75px;">Date:</div>
                  <div id="history-method-date">${new Date(item.id / 1000).toUTCString()}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Request:</div>
                  <div id="history-method-name">${item.request.params?.request?.method}</div>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 93px;">Params:</div>
                  <textarea style="background: transparent;">${JSON.stringify(item.request.params?.request?.params)}</textarea>
                </div>

                <div style="display: flex; flex-direction: row; width: 100%; gap: 0.5rem">
                  <div style="color: rgb(107 114 128); width: 75px;">Response:</div>
                  ${item.response ?
                    /* html */ `<textarea id="history-method-response" style="background: transparent;">${JSON.stringify(item.response)}</textarea>` :
                    /* html */ `<textarea style="background: transparent;">No response</textarea>`}
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

  // console.log(core.history.records)
  web3wallet.on('session_proposal', async sessionProposal => {
    const { requiredNamespaces } = sessionProposal.params;

    if (!requiredNamespaces.bch) {
      console.log("error");
      return;
    }

    const wallet = await walletClass.named(nameWallet);
    const namespaces = {
      bch: {
        methods: [
          "bch_getAddresses",
          "bch_signTransaction",
          "bch_signMessage"
        ],
        chains: [
          "bch:bitcoincash"
        ],
        events: [
          "addressesChanged"
        ],
        accounts: [`bch:${wallet.getDepositAddress()}`],
      }
    }

    document.getElementById("session-approve-button").onclick = async () => {
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
  });

  web3wallet.on('session_delete', async params => {
    await web3wallet.disconnectSession({
      topic: params.topic,
      reason: getSdkError('USER_DISCONNECTED')
    });

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
      await web3wallet.core.pairing.pair({ uri })
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
      console.log(`Code matched = ${decodedText}`);
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
    console.log(event);

    // export interface SignMessageOptions {
    //   assetId?: string;
    //   message: string;
    //   userPrompt?: string
    // }

    // message
  //   {
  //     "id": 1686314178933879,
  //     "topic": "fe4af9ac1e450c66e48e240bc1dd591ae9edf526128828e1ff3b2bd3a22e523a",
  //     "params": {
  //         "request": {
  //             "method": "bch_signMessage",
  //             "params": {
  //                 "account": "bitcoincash:qqjtahtuk64600jx6uw2uzcrj059y9tflgrsjrh496",
  //                 "payload": "05010000004254"
  //             }
  //         },
  //         "chainId": "bch:bitcoincash"
  //     },
  //     "verifyContext": {
  //         "verified": {
  //             "verifyUrl": "",
  //             "validation": "VALID",
  //             "origin": "http://localhost:3000"
  //         }
  //     }
  // }

    // transaction
  //   {
  //     "id": 1686315234896544,
  //     "topic": "fe4af9ac1e450c66e48e240bc1dd591ae9edf526128828e1ff3b2bd3a22e523a",
  //     "params": {
  //         "request": {
  //             "method": "bch_signTransaction",
  //             "params": {
  //                 "account": "bitcoincash:qqjtahtuk64600jx6uw2uzcrj059y9tflgrsjrh496",
  //                 "operations": [
  //                     {
  //                         "kind": "transaction",
  //                         "amount": "1",
  //                         "destination": "bitcoincash:qqjtahtuk64600jx6uw2uzcrj059y9tflgrsjrh496"
  //                     }
  //                 ]
  //             }
  //         },
  //         "chainId": "bch:bitcoincash"
  //     },
  //     "verifyContext": {
  //         "verified": {
  //             "verifyUrl": "",
  //             "validation": "VALID",
  //             "origin": "http://localhost:3000"
  //         }
  //     }
  // }

    // bch_getAddresses
  //   {
  //     "id": 1686315379378125,
  //     "topic": "fe4af9ac1e450c66e48e240bc1dd591ae9edf526128828e1ff3b2bd3a22e523a",
  //     "params": {
  //         "request": {
  //             "method": "bch_getAddresses",
  //             "params": {}
  //         },
  //         "chainId": "bch:bitcoincash"
  //     },
  //     "verifyContext": {
  //         "verified": {
  //             "verifyUrl": "",
  //             "validation": "VALID",
  //             "origin": "http://localhost:3000"
  //         }
  //     }
  // }

    console.log(event);
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
      case "personal_sign":
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

          const requestHtml = /* html */ `<fieldset id="wc-session-request-modal-inner-${id}" style="padding: 3rem; width: 510px; overflow-y: scroll; max-height: 90vh; background-color: white;">
            <legend style="font-size: larger;">Approve request</legend>
            <div id="wc-request">
              <div style="display: flex; justify-content: center; font-size: larger;">Sign this test message</div>
                <div style="font-size: large; margin-top: 2rem;">Origin:</div>
                <div id="session-${session.topic}" style="display: flex; align-items: center; flex-direction: row; gap: 10px; padding: 7px;">
                  <div id="session-app-icon" style="display: flex; align-items: center; height: 64px; width: 64px;"><img src="${meta.icons[0]}"></div>
                  <div style="display: flex; flex-direction: column; width: 100%;">
                    <div id="session-app-name">${peerName}</div>
                    <div id="session-app-url" style="overflow-wrap: anywhere;"><a href="${meta.url}" target="_blank">${meta.url}</a></div>
                  </div>
                </div>
                <div style="font-size: large; margin-top: 2rem;">Signer:</div>
                <div style="overflow-x: hidden; text-overflow: ellipsis; display: flex; flex-direction: row; overflow-wrap: anywhere;">
                  <div style="font-size: smaller;" class="prefix-span">bitcoincash:</div>
                  <div style="overflow-x: hidden; text-overflow: ellipsis; font-size: smaller;">${signingAddress.split(":")[1]}</div>
                  <button type="button" style="background: none; padding: 0;" onclick="navigator.clipboard.writeText(${signingAddress})">
                    <img class="copyIcon icon" src="/images/copy.svg">
                  </button>
                </div>
                <div style="font-size: large; margin-top: 2rem;">Message:</div>
                <div style="overflow-wrap: anywhere; font-size: smaller;">${message}</div>
              <hr style="margin-top: 3rem;" />
              <div style="display: flex; justify-content: center; margin-top: 1rem;">
                <input id="request-approve-button-${id}" class="button primary" type="button" value="Approve">
                <input id="request-reject-button-${id}" class="button" type="button" value="Reject">
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
        break;
      default:
        {
          const response = { id, jsonrpc: '2.0', error: {code: 1001, message: `Unsupported method ${method}`} };
          await web3wallet.respondSessionRequest({ topic, response });
        }
    }
  }

  renderRequests();
})
