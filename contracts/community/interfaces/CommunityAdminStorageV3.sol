// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./CommunityAdminStorageV2.sol";

/**
 * @title Storage for CommunityAdmin
 * @notice For future upgrades, do not change CommunityAdminStorageV2. Create a new
 * contract which implements CommunityAdminStorageV2 and following the naming convention
 * CommunityAdminStorageVX.
 */
abstract contract CommunityAdminStorageV3 is CommunityAdminStorageV2 {
    address public override authorizedWalletAddress;
    uint256 public override defaultMinClaimAmount;
}
