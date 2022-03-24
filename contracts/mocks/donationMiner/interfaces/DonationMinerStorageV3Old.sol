// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./DonationMinerStorageV2Old.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV2. Create a new
 * contract which implements DonationMinerStorageV3 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract DonationMinerStorageV3Old is DonationMinerStorageV2Old {
    uint256 public override againstPeriods;
}
