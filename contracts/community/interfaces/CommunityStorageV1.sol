// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./ICommunity.sol";
import "./ICommunityAdmin.sol";

/**
 * @title Storage for Community
 * @notice For future upgrades, do not change CommunityStorageV1. Create a new
 * contract which implements CommunityStorageV1 and following the naming convention
 * CommunityStorageVX.
 */
abstract contract CommunityStorageV1 is ICommunity {
    bool public override locked;
    uint256 public override claimAmount;
    uint256 public override baseInterval;
    uint256 public override incrementInterval;
    uint256 public override maxClaim;
    uint256 public override validBeneficiaryCount;
    uint256 public override treasuryFunds;
    uint256 public override privateFunds;
    uint256 public override decreaseStep;
    uint256 public override minTranche;
    uint256 public override maxTranche;

    ICommunity public override previousCommunity;
    ICommunityAdmin public override communityAdmin;

    mapping(address => Beneficiary) public override beneficiaries;
    EnumerableSet.AddressSet internal beneficiaryList;
}
