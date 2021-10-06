// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "hardhat/console.sol";
import "../utils/ImpactUUPS.sol";

contract CommunityAdminProxy is ImpactUUPS {
    constructor(address implementation_) ImpactUUPS(implementation_) {}
}
