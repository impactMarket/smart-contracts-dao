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
    // when there aren't enough funds into treasury, we want to limit the beneficiary claimAmount
    // the claim amount will be calculated based on the community funds and the number of beneficiary
    // originalClaimAmount * MIN_CLAIM_AMOUNT_RATIO_PRECISION / minClaimAmountRatio <=  claimAmount <= originalClaimAmount
    uint256 public override minClaimAmountRatio;
    uint256 public override treasurySafetyPercentage;
    uint256 public override treasuryMinBalance;
}
