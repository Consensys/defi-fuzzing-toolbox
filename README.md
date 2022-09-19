# Overview

Small TypeScript library allowing easy local deployment of some common defi components. Currently the library supports:

- WETH
- DAI
- USDC (currently mocked with an ERC20)
- Uniswap V2

For all components (except for USDC) the code was taken directly from etherscan.

# Installation

Run:

```sh
npm install <TODO AFTER RELEASING PACKAGE>
```

# Usage

Lets say for example you want to get a local deployment with WETH, DAI and UniswapV2 and swap 10 WETH for DAI. You can do this as follows:

1. Fire up ganache:

```sh
ganache -p 8545 --chain.allowUnlimitedContractSize
```

And from another terminal fire up nodejs and try the following:

```js
// Get an instance of the DefiToolbox. The toolbox is connected to the local ganache instance.
const { DefiToolbox } = require(".");
const tb = new DefiToolbox("http://localhost:8545");

// Get an instance of WETH. Note that this automatically deploys the contract to the local ganache instance on the first invocation. 
const weth = await tb.weth();
// weth is an instance of TruffleContract.

// Use the first account from web3.eth.getAccounts() as sender
const sender = await tb.firstAccount();

// Deposit some ETH in WETH
await weth.deposit({value: 1000000, from: sender });


// Get an instance of DAI. Note that we pass sender to the DAI constructor, so that sender is authorized to mint
const dai = await tb.dai(sender);

// Mint some dai to sender
await dai.mint(sender, 100000, { from: sender })

// Now get the UniswapV2 router. Note all deployment helpers have an implicit "sender" argument, that is the first account by default.
const router = await tb.uniswapV2Router();

// Now give the WETH/DAI pair some initial liquidity. The "2000000000" is some arbitrary deadline the future.
await dai.approve(router.address, 10000, { from: sender });
await weth.approve(router.address, 10000, { from: sender });
await router.addLiquidity(weth.address, dai.address, 10000, 10000, 0, 0, sender, 2000000000, { from: sender })

// Get WETH/DAI balances before the swap
const wethBefore = (await weth.balanceOf(sender)).toNumber();
const daiBefore = (await dai.balanceOf(sender)).toNumber();

console.error(`Before swap balance of ${sender}: WETH: ${wethBefore} DAI: ${daiBefore}`);

// Allow the router to spend 10 wei
await weth.approve(router.address, 10, { from: sender });

// Swap weth for dai
await router.swapExactTokensForTokens(
    10,
    0,
    [weth.address, dai.address],
    sender,
    2000000000,
    {
	from: sender
    }
);


// Get WETH/DAI balances after the swap
const wethAfter = (await weth.balanceOf(sender)).toNumber();
const daiAfter = (await dai.balanceOf(sender)).toNumber();

console.error(`After swap balance of ${sender}: WETH: ${wethAfter} DAI: ${daiAfter}`);
// Should print something like
// After swap balance of <sender>: WETH: 989990 DAI: 90009
```
