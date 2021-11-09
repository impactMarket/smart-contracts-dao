// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./IImpactLabsVesting.sol";

/**
 * @title Storage for ImpactLabsVesting
 * @notice For future upgrades, do not change ImpactLabsVestingStorageV1. Create a new
 * contract which implements ImpactLabsVestingStorageV1 and following the naming convention
 * ImpactLabsVestingStorageVx.
 */
abstract contract ImpactLabsVestingStorageV1 is IImpactLabsVesting {
    address public override impactLabs;
    IERC20 public override IPCT;
    IDonationMiner public override donationMiner;

    uint256 public override lastClaimedRewardPeriod;
    uint256 public override advancePayment;
}
