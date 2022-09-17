const TruffleContract = require("@truffle/contract");
const fse = require("fs-extra");

const Web3 = require("web3");
import { dirname, join } from "path";
import { HttpProvider, IpcProvider, WebsocketProvider } from "web3-core";

type Web3Provider = HttpProvider | WebsocketProvider | IpcProvider | string;
export type TruffleContractT = typeof TruffleContract;
export type AddressLike = TruffleContractT | string;

const ARTIFACTS_PATH = join(dirname(__dirname), "artifacts");

function addressOf(arg: AddressLike): string {
    return typeof arg === "string" ? arg : arg.address;
}

export class DefiToolbox {
    private readonly web3: typeof Web3;

    constructor(provider: Web3Provider) {
        this.web3 = new Web3(provider);
    }

    private getTruffleContractFactory(
        jsonFileName: string,
        mainSolFileName: string,
        contractName: string
    ): TruffleContractT {
        const json = fse.readJSONSync(jsonFileName);
        const res = TruffleContract(json.contracts[mainSolFileName][contractName]);
        res.setProvider(this.web3.currentProvider);
        return res;
    }

    private _chainId!: number | null;

    public async getChainId(): Promise<number> {
        if (!this._chainId) {
            this._chainId = await this.web3.eth.getChainId();
        }

        return this._chainId as number;
    }

    private _weth: TruffleContractT | undefined;

    private async getSender(deployerArg?: AddressLike): Promise<string> {
        return deployerArg ? addressOf(deployerArg) : await this.firstAccount();
    }

    /**
     * Return an instance of the weth contract (as obtained from etherscan.)
     * Deploy the contract if its not deployed already.
     */
    public async weth(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._weth) {
            const weth = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/weth/WETH9.json`,
                `artifacts/weth/WETH9.sol`,
                "WETH9"
            );

            const deployer = await this.getSender(deployerArg);
            this._weth = await weth.new({ from: deployer });
        }

        return this._weth;
    }

    public async giveWethTo(
        receiver: AddressLike,
        amount: number | string | bigint,
        senderArg?: AddressLike
    ): Promise<void> {
        const weth = await this.weth();
        let strAmount: string;

        if (typeof amount === "number" || typeof amount === "bigint") {
            strAmount = amount.toString();
        } else {
            strAmount = amount;
        }

        const from = await this.getSender(senderArg);
        await weth.deposit({ value: strAmount, from });
        await weth.transfer(addressOf(receiver), strAmount, { from });
    }

    private _dai: TruffleContractT | undefined;

    /**
     * Return an instance of the DAI contract (as obtained from etherscan.)
     * Deploy the contract if its not deployed already.
     */
    public async dai(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._dai) {
            const DAI = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/dai/DAI.json`,
                `artifacts/dai/DAI.sol`,
                "Dai"
            );

            const from = await this.getSender(deployerArg);
            this._dai = await DAI.new(await this.getChainId(), { from });
        }

        return this._dai;
    }

    private _usdc: TruffleContractT | undefined;
    /**
     * Return an instance of the usdc contract (we use an OZ ERC20 as a mock.)
     * Deploy the contract if its not deployed already.
     */
    public async usdc(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._usdc) {
            const usdc = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/usdc/USDC.json`,
                `artifacts/usdc/USDC.sol`,
                "USDC"
            );

            const from = await this.getSender(deployerArg);
            this._usdc = await usdc.new({ from });
        }

        return this._usdc;
    }

    private _accounts: string[] | undefined;

    public async firstAccount(): Promise<string> {
        if (!this._accounts) {
            this._accounts = await this.web3.eth.getAccounts();
        }

        return (this._accounts as string[])[0];
    }

    private _clipperExchange: TruffleContractT | undefined;
    /**
     * Return an instance of the ClipperExchange contract (as obtained from etherscan)
     * Deploy the contract if its not deployed already.
     */
    public async clipperExchange(
        signerArg?: AddressLike,
        tokensArg?: string[] | TruffleContractT[],
        deployerArg?: AddressLike
    ): Promise<TruffleContractT> {
        if (!this._clipperExchange) {
            const signer: string = signerArg ? addressOf(signerArg) : await this.firstAccount();
            const weth = await this.weth();
            let tokens: string[];

            if (tokensArg === undefined) {
                tokens = [
                    weth.address,
                    (await this.dai(deployerArg)).address,
                    (await this.usdc(deployerArg)).address
                ];
            } else if (tokensArg.length === 0 || typeof tokensArg[0] === "string") {
                tokens = tokensArg;
            } else {
                tokens = tokensArg.map((token) => token.address);
            }

            const clipperExchange = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/ClipperExchange/ClipperExchange.json`,
                `contracts/ClipperCaravelExchange.sol`,
                "ClipperCaravelExchange"
            );

            const from = await this.getSender(deployerArg);
            this._clipperExchange = await clipperExchange.new(signer, weth.address, tokens, {
                from
            });
        }

        return this._clipperExchange;
    }

    private _uniswapV2Factory: TruffleContractT | undefined;

    public async uniswapV2Factory(
        feeToSetterArg?: string,
        deployerArg?: AddressLike
    ): Promise<TruffleContractT> {
        if (!this._uniswapV2Factory) {
            const feeToSetter = feeToSetterArg ? feeToSetterArg : await this.firstAccount();
            const UniswapV2Factory = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Factory.json`,
                `artifacts/UniswapV2/UniswapV2Factory.sol`,
                "UniswapV2Factory"
            );

            const from = await this.getSender(deployerArg);
            this._uniswapV2Factory = await UniswapV2Factory.new(feeToSetter, { from });
        }

        return this._uniswapV2Factory;
    }

    private _uniswapV2Router: TruffleContractT | undefined;

    public async uniswapV2Router(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._uniswapV2Router) {
            const UniswapV2Router = await this.getTruffleContractFactory(
                `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Router02.json`,
                `artifacts/UniswapV2/UniswapV2Router02.sol`,
                "UniswapV2Router02"
            );

            const from = await this.getSender(deployerArg);
            const weth = await this.weth(deployerArg);
            const factory = await this.uniswapV2Factory(deployerArg, deployerArg);
            this._uniswapV2Router = await UniswapV2Router.new(factory.address, weth.address, {
                from,
                gas: 10000000
            });
        }

        return this._uniswapV2Router;
    }

    private readonly _uniswapPairMap = new Map<string, TruffleContractT>();

    public async uniswapV2Pair(
        token0: AddressLike,
        token1: AddressLike,
        senderArg?: AddressLike
    ): Promise<TruffleContractT> {
        const token0Addr = addressOf(token0);
        const token1Addr = addressOf(token1);

        /// Sort addresses topologically so we obtain the same pair if we swap
        /// the token addresses.
        const key =
            token0Addr < token1Addr
                ? `${token0Addr}<->${token1Addr}`
                : `${token1Addr}<->${token0Addr}`;

        const pair = this._uniswapPairMap.get(key);

        if (pair) {
            return pair;
        }

        const from = await this.getSender(senderArg);

        const factory = await this.uniswapV2Factory(senderArg);
        const transResponse = await factory.createPair(addressOf(token0), addressOf(token1), {
            from
        });

        const transReceipt = transResponse.receipt;
        const pairEmittedEvent = transReceipt.logs.filter(
            (evt: any) => evt.event === "PairCreated"
        );

        const uniswapV2Pair = await this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Pair.json`,
            `artifacts/UniswapV2/UniswapV2Pair.sol`,
            "UniswapV2Pair"
        );

        return uniswapV2Pair.at(pairEmittedEvent[0].args.pair);
    }
}
