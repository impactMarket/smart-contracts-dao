// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IStaking.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV1. Create a new
 * contract which implements DonationMinerStorageV1 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract StakingStorageV1 is IStaking {
    IERC20 public override PACT;
    IMintableToken public override SPACT;
    IDonationMiner public override donationMiner;
    uint256 public override cooldown;

    uint256 public override currentTotalAmount;

    mapping(address => Holder) internal holders;
    EnumerableSet.AddressSet internal stakeholdersList;
}
