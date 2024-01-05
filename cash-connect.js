// Import Wallet Connect
import { CashConnectWallet } from 'cashconnect';

// Import Libauth.
import { stringify, authenticationTemplateP2pkhNonHd, binToHex, hexToBin, binToNumberUintLE, cashAddressToLockingBytecode, decodePrivateKeyWif, lockingBytecodeToCashAddress } from "@bitauth/libauth";

// Import Vue.
import { createApp } from 'vue/dist/vue.esm-browser.js'

//-----------------------------------------------------------------------------
// Setup Utilities
//-----------------------------------------------------------------------------

async function getPrivateKey() {
  const wallet = await walletClass.named("mywallet")
  const privateKeyWif = wallet.privateKeyWif;
  const decodeResult = decodePrivateKeyWif(privateKeyWif);
  if (typeof decodeResult === "string") {
    throw new Error(decodeResult);
  }
  const privateKey = decodeResult.privateKey;
  return privateKey;
}

//-----------------------------------------------------------------------------
// Setup Vue
//-----------------------------------------------------------------------------

// WalletConnect Tab (CashConnect Section).
window.cashConnectSessions = createApp({
	data() {
		return {
			// List of Sessions.
			sessions: {},
		}
	},
	methods: {
		disconnectSession: async function(topic) {
			await window.cashConnectService.disconnectSession(topic);
		},
		onSessionsUpdated: async function(sessions) {
			this.sessions = sessions;
		},
	}
}).mount('#cashconnect-sessions-vue');

// CashConnect Dialogs.
window.cashConnectDialogs = createApp({
	data() {
		return {
			// List of Modals displaying for Session Requests.
			sessionRequests: [],

			// List of Modals displaying for RPC Requests.
			rpcRequests: [],

			// List of Modals displaying for Errors.
			errors: [],

			// Auto-approved methods.
			autoApprove: ['wc_authRequest', 'bch_getTokens_V0', 'bch_getBalance_V0', 'bch_getChangeLockingBytecode_V0'],
		}
	},
	computed: {
		isSessionApprovalVisible: function() {
			return this.sessionRequests.length ? true : false;
		},
		isRequestApprovalVisible: function() {
			return this.rpcRequests.length ? true : false;
		},
		isErrorsVisible: function() {
			return this.errors.length ? true : false;
		},
	},
	methods: {
		pair: async function(wcUri) {
			// Pair with the service.
			await window.cashConnectService.core.pairing.pair({ uri: wcUri });
		},

		viewTemplate: function(template) {
			// Your JSON data
			const jsonData = JSON.stringify(template, null, 2);

			// Create a new HTML document with the JSON data
			const newDoc = document.implementation.createHTMLDocument();
			const pre = newDoc.createElement('pre');
			pre.textContent = jsonData;
			newDoc.body.appendChild(pre);

			// Open a new tab with the data URL
			const newTab = window.open();
			newTab.document.write('<html><head><title>JSON Data</title></head><body><pre>' + jsonData + '</pre></body></html>');
			newTab.document.close();
		},

		//-----------------------------------------------------------------------------
		// UI Approvals
		//-----------------------------------------------------------------------------

		showApprovalModal: async function(modalType, data, onAccept) {
			const approval = new Promise(async (resolve, reject) => {
				// Generate a random ID so that we can find this dialog in our list of visible dialogs.
				// NOTE: Typically, a full-featured framework would have its own Dialog function so this wouldn't be necessary.
				//       However, I'm using Pat's HTML (albeit slightly modified) so am going to keep with his approach.
				const thisModalId = Math.floor(Math.random() * 1_000_000);

				// Push onto our list of session requests.
				// NOTE: We support more than one session request in UI at once.
				this[modalType].push({
					// Arbitrary data we are passing to modal.
					...data,
					// Modal-specific
					modalId: thisModalId,
					accept: async () => {
						// Remove this request from our list of requests.
						this[modalType] = this[modalType].filter((modal) => modal.modalId !== thisModalId );

						// Execute the onAccept callback.
						if (onAccept) {
							resolve(await onAccept());
						} else {
							resolve();
						}
					},
					reject: async () => {
						// Remove this request from our list of requests.
						this[modalType] = this[modalType].filter((modal) => modal.modalId !== thisModalId);

						// Reject the promise with an error.
						reject('User rejected')
					},
				});
			});

			return approval;
		},

		onSessionProposal: async function(sessionProposal) {
			// NOTE: The walletClass.network property appears to return quirky values (e.g. undefined).
			//       So we use the networkPrefix property to determine which chain we are currently on.
			const currentChain = window.walletClass.networkPrefix;
			const targetChain = sessionProposal.params.requiredNamespaces.bch.chains[0].replace('bch:', '');

			// Cashonize expects network to be either mainnet or chipnet.
			const targetChainCashonizeFormat = (targetChain === 'bitcoincash') ? 'mainnet' : 'chipnet';

			// Check if the current chain is the target chain.
			if(currentChain !== targetChain) {
				// If it is not, prompt user to switch.
				if (!confirm(`Dapp requires ${targetChain}, but you are using ${currentChain}. Would you like to switch to ${targetChain}?`)) {
					throw new Error(`Wallet is using ${currentChain}: ${targetChain} required`);
				}

				// Switch if user answered yes to prompt.
				changeNetwork({ target: { value: targetChainCashonizeFormat } });
				changeView(4);
			}

			// Show a modal to approve the session request.
			return this.showApprovalModal('sessionRequests', {
				session: sessionProposal,
			}, async () => {
				return {
					autoApprove: this.autoApprove
				}
			});
		},

		onRPCRequest: async function(session, request, response) {
			// If this method is not whitelisted...
			if(!this.autoApprove.includes(request.method)) {
				// Show a modal to approve the RPC Request.
				return this.showApprovalModal('rpcRequests', {
					method: request.method,
					session,
					params: request.params,
					response,
				});
			}
		},

		onError: async function(error) {
			// Print error to console first in case something goes wrong in render.
			console.error(error);

			// Show the error in a dialog.
			return this.showApprovalModal('errors', {
				error
			});
		},

		//-----------------------------------------------------------------------------
		// Formatting Utils
		//-----------------------------------------------------------------------------

		formatBin(bin) {
			return binToHex(bin);
		},

		formatSessionSigner(session) {
			return session?.namespaces?.['bch']?.accounts?.[0] || 'Unable to display signer';
		},

		formatScriptName(scriptId, template) {
			return template?.scripts?.[scriptId]?.name || scriptId;
		},

		formatDataName(dataId, template) {
			return template?.entities?.common?.variables?.[dataId]?.name || dataId;
		},

		formatDataValue(value, dataId, template) {
			const type = template?.entities?.common?.variables?.[dataId]?.description;

			switch (type) {
				case 'lockscript': return this.formatLockscript(value);
				case 'number': return binToNumberUintLE(value);
				case 'unixTimestamp': return new Date(binToNumberUintLE(value) * 1000).toISOString();
			}

			return `0x${binToHex(value)}`;
		},

		formatLockscript(lockingBytecode) {
			const result = lockingBytecodeToCashAddress(lockingBytecode, 'bitcoincash');
			if (typeof result !== "string") {
				return binToHex(lockingBytecode);
			}
			return result;
		},

		formatSats(satoshis) {
			const numberAmount = Number(satoshis);
			if (Math.abs(numberAmount / (10 ** 4)) > 1000) {
				const bchAmount = numberAmount * (10 ** -8)
				return `${bchAmount.toFixed(8)} BCH`
			} else {
				return `${numberAmount} Sats`
			}
		},

		stringify(payload) {
				return stringify(payload);
		}
	}
}).mount('#cashconnect-dialogs-vue');

//-----------------------------------------------------------------------------
// Start Wallet Connect
//-----------------------------------------------------------------------------

// NOTE: We have to wait for the wallet to load.
//       So this gets called in script.js under loadWalletInfo() (at the very end).
window.initCashConnect = async () => {
	const privateKey = await getPrivateKey();

	// Setup Wallet Connect.
	window.cashConnectService = new CashConnectWallet(
		// The master private key.
		privateKey,
		// Project ID.
		'3fd234b8e2cd0e1da4bc08a0011bbf64',
		// Metadata.
		{
			name: 'Cashonize',
			description: 'Cashonize BitcoinCash Web Wallet',
			url: 'cashonize.com/',
			icons: ['https://cashonize.com/images/favicon.ico'],
		},
		// Event Callbacks.
		{
			// Session State Callbacks.
			onSessionsUpdated: window.cashConnectSessions.onSessionsUpdated,
			onSessionProposal: window.cashConnectDialogs.onSessionProposal,
			onSessionDelete: () => {},
			onRPCRequest: window.cashConnectDialogs.onRPCRequest,
			onError: window.cashConnectDialogs.onError,
		},
		// CashRPC Callbacks.
		{
			// Network-related callbacks.
			network: {
				// Get the source output of the given transaction and index.
				getSourceOutput: async (outpointTransactionHash, outpointIndex) => {
					const wallet = await walletClass.named("mywallet");

					const transaction = await wallet.provider.getRawTransactionObject(binToHex(outpointTransactionHash));

					const outpoint = transaction.vout[outpointIndex];

					let token;

					if(outpoint.tokenData) {
						token = {
							amount: BigInt(outpoint.tokenData.amount),
							category: hexToBin(outpoint.tokenData.category),
							nft: outpoint.tokenData.nft ? {
								capability: outpoint.tokenData.nft.capability,
								commitment: outpoint.tokenData.nft.commitment ? hexToBin(outpoint.tokenData.nft.commitment) : undefined,
							} : undefined
						}
					}

					const formatted = {
						valueSatoshis: BigInt(Math.round(outpoint.value * 100_000_000)),
						lockingBytecode: hexToBin(outpoint.scriptPubKey.hex),
						token,
					}

					return formatted;
				},

				// NOTE: Other callbacks may be supported in future (e.g. Block Height).
			},

			// Wallet-related callbacks.
			wallet: {
				// Get the unspents available for this wallet.
				getUnspents: async () => {
					const wallet = await walletClass.named("mywallet");

					const utxos = await wallet.getUtxos();

					const privateKey = await getPrivateKey();

					const lockingBytecode = cashAddressToLockingBytecode(wallet.cashaddr);

					if(typeof lockingBytecode === 'string') {
						throw new Error('Failed to convert CashAddr to Locking Bytecode');
					}

					const transformed = utxos.map((utxo) => {
						let token;

						if(utxo.token) {
							token = {
								amount: BigInt(utxo.token.amount),
								category: hexToBin(utxo.token.tokenId),
							}

							if(utxo.token.capability || utxo.token.commitment) {
								token.nft = {
									capability: utxo.token.capability,
									commitment: hexToBin(utxo.token.commitment),
								}
							}
						}

						return {
							outpointTransactionHash: hexToBin(utxo.txid),
							outpointIndex: utxo.vout,
							lockingBytecode: lockingBytecode.bytecode,
							unlockingBytecode: {
								template: authenticationTemplateP2pkhNonHd,
								valueSatoshis: BigInt(utxo.satoshis),
								script: 'unlock',
								data: {
									keys: {
										privateKeys: {
											key: privateKey,
										},
									},
								},
								token,
							}
						}
					})

					return transformed;
				},

				// Get the LibAuth change template for this wallet.
				getChangeTemplate: async () => {
					return {
						template: authenticationTemplateP2pkhNonHd,
						data: {
							keys: {
								privateKeys: {
									key: await getPrivateKey()
								}
							}
						}
					}
				},
			},
		},
	);

	// Start Wallet Connect.
	await window.cashConnectService.start();

	// Handle URL.
	// NOTE: To differentiate from Pat's implementation, we use protohandler "cc:" (CashConnect:).
	// NOTE: "web+cc:" is also supported to support PWA Wallets.
	const wcuri = new URL(window.location.href.replace("#", "")).searchParams.get("uri");
	if (wcuri && (wcuri.indexOf("cc:") === 0 || wcuri.indexOf('web+cc:') === 0)) {
		const pairings = window.cashConnectService.core.pairing.pairings.getAll();
		const topic = wcuri.match(/^cc:([a-zA-Z0-9]+).*/)?.[1];
		if (pairings.some(val => val.topic === topic)) {
			// skip
		} else {
			window.cashConnectService.pair(wcuri);
		}
	}
};
