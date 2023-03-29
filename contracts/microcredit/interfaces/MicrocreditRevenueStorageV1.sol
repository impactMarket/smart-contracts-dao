// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IMicrocreditRevenue.sol";

/**
 * @title Storage for MicrocreditRevenue
 * @notice For future upgrades, do not change MicrocreditRevenueStorageV1. Create a new
 * contract which implements MicrocreditRevenueStorageV1 and following the naming convention
 * MicrocreditRevenueStorageVx.
 */
abstract contract MicrocreditRevenueStorageV1 is IMicrocreditRevenue {
}
