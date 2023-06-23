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
    IDonationMiner public override donationMiner;
    ISocialConnect public override socialConnect;
    address public override socialConnectIssuer;

    uint256 public override amount;

    mapping(address => Beneficiary) public beneficiaries;
}
