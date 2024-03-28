const TruffleContract = require("@truffle/contract");
const fse = require("fs-extra");

const Web3 = require("web3");
import { join } from "path";
import { HttpProvider, IpcProvider, WebsocketProvider } from "web3-core";

type Web3Provider = HttpProvider | WebsocketProvider | IpcProvider | string;
export type TruffleContractT = typeof TruffleContract;
export type AddressLike = TruffleContractT | string;
export type NumberLike = number | bigint | string;

const ARTIFACTS_PATH = join(__dirname, "artifacts");

function addressOf(arg: AddressLike): string {
    return typeof arg === "string" ? arg : arg.address;
}

function toNumStr(arg: NumberLike): string {
    if (typeof arg === "number" || typeof arg === "bigint") {
        return arg.toString();
    } else {
        return arg;
    }
}

export class DefiToolbox {
    private readonly web3: typeof Web3;

    constructor(provider: Web3Provider) {
        this.web3 = new Web3(provider);
    }

    public getTruffleContractFactory(
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

    public async wethContract(): Promise<TruffleContractT> {
        return await this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/weth/WETH9.json`,
            `artifacts/weth/WETH9.sol`,
            "WETH9"
        );
    }

    /**
     * Return an instance of the weth contract (as obtained from etherscan.)
     * Deploy the contract if its not deployed already.
     */
    public async weth(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._weth) {
            const wethFactory = await this.wethContract();

            const deployer = await this.getSender(deployerArg);
            this._weth = await wethFactory.new({ from: deployer });
        }

        return this._weth;
    }

    public async giveWethTo(
        receiver: AddressLike,
        amount: NumberLike,
        senderArg?: AddressLike
    ): Promise<void> {
        const weth = await this.weth();
        const from = await this.getSender(senderArg);
        const strAmount = toNumStr(amount);

        await weth.deposit({ value: strAmount, from });
        await weth.transfer(addressOf(receiver), strAmount, { from });
    }

    private _dai: TruffleContractT | undefined;

    public async daiContract(): Promise<TruffleContractT> {
        return await this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/dai/DAI.json`,
            `artifacts/dai/DAI.sol`,
            "Dai"
        );
    }

    /**
     * Return an instance of the DAI contract (as obtained from etherscan.)
     * Deploy the contract if its not deployed already.
     */
    public async dai(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._dai) {
            const DAI = await this.daiContract();

            const from = await this.getSender(deployerArg);
            this._dai = await DAI.new(await this.getChainId(), { from });
        }

        return this._dai;
    }

    private _usdc: TruffleContractT | undefined;

    public async usdcContract(): Promise<TruffleContractT> {
        return await this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/usdc/USDC.json`,
            `artifacts/usdc/USDC.sol`,
            "USDC"
        );
    }

    /**
     * Return an instance of the usdc contract (we use an OZ ERC20 as a mock.)
     * Deploy the contract if its not deployed already.
     */
    public async usdc(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._usdc) {
            const usdc = await this.usdcContract();

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

    public async clipperExchangeContract(): Promise<TruffleContractT> {
        return this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/ClipperExchange/ClipperExchange.json`,
            `contracts/ClipperCaravelExchange.sol`,
            "ClipperCaravelExchange"
        );
    }

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

            const clipperExchange = await this.clipperExchangeContract();

            const from = await this.getSender(deployerArg);
            this._clipperExchange = await clipperExchange.new(signer, weth.address, tokens, {
                from
            });
        }

        return this._clipperExchange;
    }

    private _uniswapV2Factory: TruffleContractT | undefined;

    public async uniswapV2FactoryContract(): Promise<TruffleContractT> {
        return this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Factory.json`,
            `artifacts/UniswapV2/UniswapV2Factory.sol`,
            "UniswapV2Factory"
        );
    }

    public async uniswapV2Factory(
        feeToSetterArg?: string,
        deployerArg?: AddressLike
    ): Promise<TruffleContractT> {
        if (!this._uniswapV2Factory) {
            const feeToSetter = feeToSetterArg ? feeToSetterArg : await this.firstAccount();
            const UniswapV2Factory = await this.uniswapV2FactoryContract();

            const from = await this.getSender(deployerArg);
            this._uniswapV2Factory = await UniswapV2Factory.new(feeToSetter, { from });
        }

        return this._uniswapV2Factory;
    }

    private _uniswapV2Router: TruffleContractT | undefined;

    public async uniswapV2RouterContract(): Promise<TruffleContractT> {
        return this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Router02.json`,
            `artifacts/UniswapV2/UniswapV2Router02.sol`,
            "UniswapV2Router02"
        );
    }

    public async uniswapV2Router(deployerArg?: AddressLike): Promise<TruffleContractT> {
        if (!this._uniswapV2Router) {
            const UniswapV2Router = await this.uniswapV2RouterContract();

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

    public async uniswapV2PairContract(): Promise<TruffleContractT> {
        return this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/UniswapV2/UniswapV2Pair.json`,
            `artifacts/UniswapV2/UniswapV2Pair.sol`,
            "UniswapV2Pair"
        );
    }

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

        const uniswapV2Pair = await this.uniswapV2PairContract();
        return uniswapV2Pair.at(pairEmittedEvent[0].args.pair);
    }

    public async ierc20At(addr: AddressLike): Promise<TruffleContractT> {
        const IERC20 = await this.getTruffleContractFactory(
            `${ARTIFACTS_PATH}/ERC20/MintableERC20.json`,
            `@openzeppelin/contracts/token/ERC20/IERC20.sol`,
            "IERC20"
        );
        return IERC20.at(addressOf(addr));
    }

    /*
    public async uniswapV2PairGrantLiquidity(
        token0: AddressLike,
        token1: AddressLike,
        token0Liquidity: NumberLike,
        token1Liquidity: NumberLike
    ): Promise<void> {
        const erc20_0 = await this.ierc20At(token0);
        const erc20_1 = await this.ierc20At(token0);

        const router = await this.uniswapV2Router();
    }
    */
}
