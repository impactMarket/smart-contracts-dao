// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./CommunityAdminImplementation.sol";

import "hardhat/console.sol";

contract CommunityAdminProxy is TransparentUpgradeableProxy {
    constructor(address logic_, address proxyAdmin_)
        TransparentUpgradeableProxy(logic_, proxyAdmin_, "")
    {}
}
