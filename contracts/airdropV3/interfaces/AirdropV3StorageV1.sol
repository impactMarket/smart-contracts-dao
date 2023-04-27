// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./IAirdropV3.sol";

/**
 * @title Storage for AirdropV3
 * @notice For future upgrades, do not change AirdropV3StorageV1. Create a new
 * contract which implements AirdropV3StorageV1 and following the naming convention
 * AirdropV3StorageVx.
 */
abstract contract AirdropV3StorageV1 is IAirdropV3 {
    IERC20 public override PACT;
    ISocialConnect public override socialConnect;
    address public override socialConnectIssuer;

    uint256 public override startTime;
    uint256 public override trancheAmount;
    uint256 public override totalAmount;
    uint256 public override cooldown;

    mapping(address => Beneficiary) public beneficiaries;
}
