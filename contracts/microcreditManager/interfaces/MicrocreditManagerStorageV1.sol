// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./IMicrocreditManager.sol";

/**
 * @title Storage for MicrocreditManager
 * @notice For future upgrades, do not change MicrocreditManagerStorageV1. Create a new
 * contract which implements MicrocreditManagerStorageV1 and following the naming convention
 * MicrocreditManagerStorageVx.
 */
abstract contract MicrocreditManagerStorageV1 is IMicrocreditManager {
    uint256 public override rewardPercentage;
    IMicrocredit public override microcredit;
    IQuoter public override uniswapQuoter;

    EnumerableSet.AddressSet internal _referenceTokenList;
    mapping(address => ReferenceToken) internal _referenceTokens;

    EnumerableSet.AddressSet internal _managerList;
    mapping(address => Manager) internal _managers;
}
