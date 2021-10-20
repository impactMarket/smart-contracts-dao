// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./IDonationMiner.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV1. Create a new
 * contract which implements DonationMinerStorageV1 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract DonationMinerStorageV1 is IDonationMiner {
    IERC20 internal _cUSD;
    IERC20 internal _IPCT;
    ITreasury internal _treasury;
    uint256 internal _rewardPeriodSize;
    uint256 internal _startingBlock;
    uint256 internal _donationCount;
    uint256 internal _rewardPeriodCount;
    uint256 internal _decayNumerator;
    uint256 internal _decayDenominator;

    mapping(uint256 => Donation) internal _donations;
    mapping(uint256 => RewardPeriod) internal _rewardPeriods;
    mapping(address => Donor) internal _donors;
}
