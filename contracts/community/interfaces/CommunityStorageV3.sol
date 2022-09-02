// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./CommunityStorageV2.sol";

/**
 * @title Storage for Community
 * @notice For future upgrades, do not change CommunityStorageV3. Create a new
 * contract which implements CommunityStorageV3 and following the naming convention
 * CommunityStorageVX.
 */
abstract contract CommunityStorageV3 is CommunityStorageV2 {
    Token[] public override tokens;
    EnumerableSet.AddressSet internal _tokenList;
}
