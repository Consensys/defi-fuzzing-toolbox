import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract USDC is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("USDC", "USDC") {
    }
}
