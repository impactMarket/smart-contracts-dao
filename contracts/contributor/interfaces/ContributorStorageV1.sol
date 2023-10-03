// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IContributor.sol";

/**
 * @title Storage for Contributor
 * @notice For future upgrades, do not change ContributorStorageV1. Create a new
 * contract which implements ContributorStorageV1 and following the naming convention
 * ContributorStorageVx.
 */
abstract contract ContributorStorageV1 is IContributor {
    IERC20 public override PACT;
    uint256 public override claimDelay;
    IQuoter public override uniswapQuoter;
    bytes public override exchangePathCUSDToPACT;

    EnumerableSet.AddressSet internal contributorList;
    mapping(address => Contributor) public contributors;
}
