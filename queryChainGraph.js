async function queryChainGraph(queryReq, chaingraphUrl){
    const jsonObj = {
        "operationName": null,
        "variables": {},
        "query": queryReq
    };
    const response = await fetch(chaingraphUrl, {
        method: "POST",
        mode: "cors", // no-cors, *cors, same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin", // include, *same-origin, omit
        headers: {
            "Content-Type": "application/json",
        },
        redirect: "follow", // manual, *follow, error
        referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(jsonObj), // body data type must match "Content-Type" header
    });
    return await response.json();
}

export async function queryTotalSupplyFT(tokenId, chaingraphUrl){
    const queryReqTotalSupply = `query {
        transaction(
          where: {
            inputs: {
              outpoint_transaction_hash: { _eq: "\\\\x${tokenId}" }
              outpoint_index: { _eq: 0 }
            }
          }
        ) {
          outputs(where: { token_category: { _eq: "\\\\x${tokenId}" } }) {
            fungible_token_amount
          }
        }
      }`;
    return await queryChainGraph(queryReqTotalSupply, chaingraphUrl);
}

export async function queryActiveMinting(tokenId, chaingraphUrl){
    const queryReqActiveMinting = `query {
        output(
          where: {
            token_category: { _eq: "\\\\x${tokenId}" }
            _and: { nonfungible_token_capability: { _eq: "minting" } }
            _not: { spent_by: {} }
          }
        ) {
          locking_bytecode
        }
      }`;
    return await queryChainGraph(queryReqActiveMinting, chaingraphUrl);
}

export async function querySupplyNFTs(tokenId, chaingraphUrl, offset =0){
    const queryReqTotalSupply = `query {
        output(
          offset: ${offset}
          where: {
            token_category: {
              _eq: "\\\\x${tokenId}"
            }
            _and: [
              { nonfungible_token_capability: { _eq: "none" } }
            ]
            _not: { spent_by: {} }
          }
        ) {
          locking_bytecode
        }
    }`;
    return await queryChainGraph(queryReqTotalSupply, chaingraphUrl);
}

export async function queryAuthHead(tokenId, chaingraphUrl){
  const queryReqAuthHead = `query {
    transaction(
      where: {
        hash: {
          _eq: "\\\\x${tokenId}"
        }
      }
    ) {
      hash
      authchains {
        authhead {
          hash
        }
      }
    }
  }`;
  return await queryChainGraph(queryReqAuthHead, chaingraphUrl);
}
