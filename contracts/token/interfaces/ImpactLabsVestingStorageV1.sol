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
    address internal _impactLabs;
    IERC20 internal _IPCT;
    IDonationMiner internal _donationMiner;

    uint256 _lastClaimedRewardPeriod;
    uint256 _advancePayment;
}
