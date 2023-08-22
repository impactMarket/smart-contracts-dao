// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IContributor.sol";

/**
 * @title Storage for Deposit
 * @notice For future upgrades, do not change ContributorStorageV1. Create a new
 * contract which implements ContributorStorageV1 and following the naming convention
 * ContributorStorageVx.
 */
abstract contract ContributorStorageV1 is IContributor {
    IERC20 public override PACT;
    IERC20 public override cUSD;
    ITreasury public override treasury;

    uint256 public override claimPeriod;

    EnumerableSet.AddressSet internal contributorList;
    mapping(address => Contributor) public contributors;
}
