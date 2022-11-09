// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./ILearnAndEarn.sol";

/**
 * @title Storage for LearnAndEarn
 * @notice For future upgrades, do not change LearnAndEarnStorageV1. Create a new
 * contract which implements LearnAndEarnStorageV1 and following the naming convention
 * LearnAndEarnStorageVX.
 */
abstract contract LearnAndEarnStorageV1 is ILearnAndEarn {
    address public override signerWalletAddress;
    ICommunityAdmin public override communityAdmin;
    mapping(uint256 => Program) _programs;
}
