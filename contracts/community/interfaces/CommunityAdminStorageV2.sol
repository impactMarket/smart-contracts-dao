// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./CommunityAdminStorageV1.sol";
import "../../governor/impactMarketCouncil/interfaces/IImpactMarketCouncil.sol";
import "../../ambassadors/interfaces/IAmbassadors.sol";

/**
 * @title Storage for CommunityAdmin
 * @notice For future upgrades, do not change CommunityAdminStorageV1. Create a new
 * contract which implements CommunityAdminStorageV1 and following the naming convention
 * CommunityAdminStorageVX.
 */
abstract contract CommunityAdminStorageV2 is CommunityAdminStorageV1 {
    IImpactMarketCouncil public override impactMarketCouncil;
    IAmbassadors public override ambassadors;
    address public override communityMiddleProxy;
    address public override authorizedWalletAddress;
}
