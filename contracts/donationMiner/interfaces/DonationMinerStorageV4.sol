// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./DonationMinerStorageV3.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV4. Create a new
 * contract which implements DonationMinerStorageV4 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract DonationMinerStorageV4 is DonationMinerStorageV3 {
    IStaking public override staking;
    //ratio between 1 cUSD donated and 1 PACT staked
    uint256 public override stakingDonationRatio;
    uint256 public override communityDonationRatio;
}
