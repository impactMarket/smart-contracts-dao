// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DonationMinerProxy is TransparentUpgradeableProxy {
    constructor(address logic_, address proxyAdmin_)
        TransparentUpgradeableProxy(logic_, proxyAdmin_, "")
    {}
}
