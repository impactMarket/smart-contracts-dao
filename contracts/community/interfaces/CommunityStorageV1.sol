// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

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
    bool internal _locked;
    uint256 internal _claimAmount;
    uint256 internal _baseInterval;
    uint256 internal _incrementInterval;
    uint256 internal _maxClaim;
    uint256 internal _validBeneficiaryCount;
    uint256 internal _treasuryFunds;
    uint256 internal _privateFunds;
    uint256 internal _decreaseStep;
    uint256 internal _minTranche;
    uint256 internal _maxTranche;

    ICommunity internal _previousCommunity;
    ICommunityAdmin internal _communityAdmin;

    mapping(address => Beneficiary) internal _beneficiaries;
    EnumerableSet.AddressSet internal _beneficiaryList;
    EnumerableSet.AddressSet internal _managerBlockList;
}
