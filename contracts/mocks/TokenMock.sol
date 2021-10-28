//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

//used only for testing
contract TokenMock is ERC20PresetMinterPauser {
    constructor(string memory name, string memory symbol) ERC20PresetMinterPauser(name, symbol) {}
}
