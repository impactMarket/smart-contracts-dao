//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory _name, string memory _symbol, uint _initialSupply) ERC20(_name, _symbol)
    {
        _mint(msg.sender, _initialSupply);
    }
}
