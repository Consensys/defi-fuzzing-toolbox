import { expect } from "chai";
import { ChildProcess, spawn } from "child_process";
import { AddressLike, DefiToolbox, TruffleContractT } from "../src";
import os from "os";

const PORT = 9545;
const DEFAULT_BALANCE = "1000000000";
const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("Deploy all artifacts", async () => {
    let ganacheProc: ChildProcess;
    let toolbox: DefiToolbox;
    let weth: TruffleContractT;
    let dai: TruffleContractT;
    let usdc: TruffleContractT;
    let deployer: AddressLike;
    let clipper: TruffleContractT;
    let uniswapV2WETHDAIPair: TruffleContractT;
    let uniswapV2Router: TruffleContractT;

    before(async () => {
        console.error(`Starting ganache...`);
        ganacheProc = spawn(`ganache`, [
            `-p`,
            `${PORT}`,
            `-e`,
            `${DEFAULT_BALANCE}`,
            "--deterministic",
            "-l",
            "60000000",
            "--chain.allowUnlimitedContractSize"
        ]);

        await timer(2000);

        toolbox = new DefiToolbox(`http://localhost:${PORT}`);
    });

    it("Get deployer", async () => {
        deployer = await toolbox.firstAccount();
    });

    it("Deploy Weth and give some weth to deployer", async () => {
        weth = await toolbox.weth();
        const amt = "10000000000";
        await toolbox.giveWethTo(deployer, amt);

        const balance = await weth.balanceOf(deployer);
        expect(balance.toString()).to.equal(amt);
    });

    it("Deploy Dai and mint tokens", async () => {
        dai = await toolbox.dai();
        const amt = "100000000001";
        await dai.mint(deployer, amt, { from: deployer });

        const balance = await dai.balanceOf(deployer);
        expect(balance.toString()).to.equal(amt);
    });

    it("Deploy USDC and mint tokens", async () => {
        usdc = await toolbox.usdc();
        const amt = "100000002";
        await usdc.mint(deployer, amt, { from: deployer });

        const balance = await usdc.balanceOf(deployer);
        expect(balance.toString()).to.equal(amt);
    });

    it("Deploy ClipperExchange", async () => {
        clipper = await toolbox.clipperExchange();
        /// TODO: Write some actual tests with clipper deployment
        expect(clipper.address).to.not.equal("");
    });

    it("Deploy Uniswap and some swaps", async () => {
        uniswapV2Router = await toolbox.uniswapV2Router();
        uniswapV2WETHDAIPair = await toolbox.uniswapV2Pair(weth, dai);

        const wethLiqidity = 10;
        const daiLiquidity = 10;
        await weth.approve(uniswapV2Router.address, wethLiqidity.toString(), { from: deployer });
        await dai.approve(uniswapV2Router.address, daiLiquidity.toString(), { from: deployer });

        await uniswapV2Router.addLiquidity(
            weth.address,
            dai.address,
            wethLiqidity.toString(),
            daiLiquidity.toString(),
            "0",
            "0",
            deployer,
            2000000000,
            {
                from: deployer
            }
        );

        await weth.approve(uniswapV2WETHDAIPair.address, 100000000, { from: deployer });

        const daiBalance = await dai.balanceOf(uniswapV2WETHDAIPair.address);
        const wethBalance = await weth.balanceOf(uniswapV2WETHDAIPair.address);
        const reserves = await uniswapV2WETHDAIPair.getReserves();
        console.error(`Reserves: ${JSON.stringify(reserves)}`);
        console.error(`daiBalance: ${daiBalance} wethBalance: ${wethBalance}`);

        /*
        const wethBefore = await weth.balanceOf(deployer).toString();
        const daiBefore = await dai.balanceOf(deployer).toString();

        await uniswapV2WETHDAIPair.swap(1, 1, deployer, "0x", { from: deployer });

        const wethAfter = await weth.balanceOf(deployer).toString();
        const daiAfter = await dai.balanceOf(deployer).toString();

        console.error(
            `Weth before: ${wethBefore} after: ${wethAfter}. Dai before ${daiBefore} after ${daiAfter}`
        );
        */
    });

    after(() => {
        console.error(`Killing ganache.`);
        ganacheProc.kill(os.constants.signals.SIGINT);
        ganacheProc.kill(os.constants.signals.SIGABRT);
        ganacheProc.kill(os.constants.signals.SIGKILL);
    });
});
