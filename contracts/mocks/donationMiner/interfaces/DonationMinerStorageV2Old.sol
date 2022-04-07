// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./DonationMinerStorageV1Old.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV2. Create a new
 * contract which implements DonationMinerStorageV2 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract DonationMinerStorageV2Old is DonationMinerStorageV1Old {
    uint256 public override claimDelay;
}
