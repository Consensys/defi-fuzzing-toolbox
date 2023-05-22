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

        ganacheProc.on("error", (data) => {
            console.error(`Failed starting/running ganache: `, data);
        });

        await timer(2000);

        toolbox = new DefiToolbox(`http://127.0.0.1:${PORT}`);
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

        const wethLiqidity = 100000;
        const daiLiquidity = 100000;
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

        const wethBefore = BigInt((await weth.balanceOf(deployer)).toString());
        const daiBefore = BigInt((await dai.balanceOf(deployer)).toString());

        await weth.approve(uniswapV2Router.address, 10, { from: deployer });
        const transfer = 10;
        await uniswapV2Router.swapExactTokensForTokens(
            transfer.toString(),
            "0",
            [weth.address, dai.address],
            deployer,
            2000000000,
            {
                from: deployer
            }
        );

        const wethAfter = BigInt((await weth.balanceOf(deployer)).toString());
        const daiAfter = BigInt((await dai.balanceOf(deployer)).toString());

        expect(wethBefore - wethAfter === BigInt(transfer)).to.be.true;
        expect(daiAfter > daiBefore).to.be.true;
    });

    after(() => {
        console.error(`Killing ganache.`);
        ganacheProc.kill(os.constants.signals.SIGINT);
        ganacheProc.kill(os.constants.signals.SIGABRT);
        ganacheProc.kill(os.constants.signals.SIGKILL);
    });
});
