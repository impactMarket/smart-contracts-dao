// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract CommunityAdminProxy is TransparentUpgradeableProxy {
    constructor(address logic_, address proxyAdmin_)
        TransparentUpgradeableProxy(logic_, proxyAdmin_, "")
    {}
}
