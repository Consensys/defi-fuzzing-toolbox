import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MintableERC20 is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("MintableERC20", "ERC20") {
    }
}
