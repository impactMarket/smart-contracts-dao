// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./CommunityStorageV1.sol";

/**
 * @title Storage for Community
 * @notice For future upgrades, do not change CommunityStorageV2. Create a new
 * contract which implements CommunityStorageV2 and following the naming convention
 * CommunityStorageVX.
 */
abstract contract CommunityStorageV2 is CommunityStorageV1 {
    IERC20 public _token;
    uint256 public override maxBeneficiaries;
}
