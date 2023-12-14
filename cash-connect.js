// Import Wallet Connect
import { WalletConnectService } from 'bch-wc2-experimental';

// Import Libauth.
import { stringify, authenticationTemplateP2pkhNonHd, binToHex, hexToBin, binToNumberUintLE, cashAddressToLockingBytecode, decodePrivateKeyWif, lockingBytecodeToCashAddress } from "@bitauth/libauth";

// Import Vue.
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'

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

// Application Template
const vueApp = createApp({
	data() {
		return {
			// Form state.
			wcUri: '',

			// List of Sessions.
			sessions: {},

			// List of Modals displaying for Session Requests.
			sessionRequests: [],

			// List of Modals displaying for RPC Requests.
			rpcRequests: [],
		}
	},
	computed: {
		isSessionApprovalVisible: function() {
			return this.sessionRequests.length ? true : false;
		},
		isRequestApprovalVisible: function() {
			return this.rpcRequests.length ? true : false;
		}
	},
	methods: {
		disconnectSession: async function(topic) {
			await window.walletConnectService.disconnectSession(topic);
		},

		pair: async function(wcUri) {
			// Pair with the service.
			await window.walletConnectService.core.pairing.pair({ uri: wcUri });

			// Clear the input.
			this.wcUri = '';
		},

		onSessionsUpdated: async function(sessions) {
			this.sessions = sessions;
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
			// Show a modal to approve the session request.
			return this.showApprovalModal('sessionRequests', {
				session: sessionProposal,
			}, async () => {
				return await getPrivateKey();
			});
		},

		onRPCRequest: async function(session, request, response) {
			// Define a list of whitelisted methods that do not require approval.
			const whitelistedMethods = ['wc_authRequest', 'bch_getTokens_V0', 'bch_getBalance_V0', 'bch_getChangeLockingBytecode_V0'];

			// If this method is not whitelisted...
			if(!whitelistedMethods.includes(request.method)) {
				// Show a modal to approve the RPC Request.
				return this.showApprovalModal('rpcRequests', {
					method: request.method,
					session,
					params: request.params,
					response,
				});
			}
		},

		onError: async function(message) {
			alert(message);
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
}).mount('#cashconnect-vue');

//-----------------------------------------------------------------------------
// Start Wallet Connect
//-----------------------------------------------------------------------------

// Dirty, but we need to wait for Mainnet to load.
// Otherwise, "walletClass" isn't available.
setTimeout(async () => {
	const privateKey = await getPrivateKey();

	// Setup Wallet Connect.
	window.walletConnectService = new WalletConnectService(
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
			onSessionsUpdated: vueApp.onSessionsUpdated,
			onSessionProposal: vueApp.onSessionProposal,
			onSessionDelete: () => {},
			onRPCRequest: vueApp.onRPCRequest,
			onError: vueApp.onError,
		},
		// Wallet Callbacks.
		{
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
		privateKey,
	);

	// Start Wallet Connect.
	await window.walletConnectService.start();

	// Handle URL.
	// NOTE: To differentiate from Pat's implementation, we use protohandler "cc:" (CashConnect:).
	const wcuri = new URL(window.location.href.replace("#", "")).searchParams.get("uri");
	if (wcuri && wcuri.indexOf("cc:") === 0) {
		const pairings = window.walletConnectService.core.pairing.pairings.getAll();
		const topic = wcuri.match(/^cc:([a-zA-Z0-9]+).*/)?.[1];
		if (pairings.some(val => val.topic === topic)) {
			// skip
		} else {
			// Convert back into a WC URI.
			const asWcUrl = wcuri.replace('cc:', 'wc:');
			vueApp.pair(asWcUrl);
		}
	}
}, 2000);
