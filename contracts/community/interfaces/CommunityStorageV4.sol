// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./CommunityStorageV3.sol";

/**
 * @title Storage for Community
 * @notice For future upgrades, do not change CommunityStorageV4. Create a new
 * contract which implements CommunityStorageV4 and following the naming convention
 * CommunityStorageVX.
 */
abstract contract CommunityStorageV4 is CommunityStorageV3 {
    ICommunity public override copyOf;
    EnumerableSet.AddressSet internal _copies;
}
