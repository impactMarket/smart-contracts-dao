// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IReferralLink.sol";

/**
 * @title Storage for ReferralLink
 * @notice For future upgrades, do not change ReferralLinkStorageV1. Create a new
 * contract which implements ReferralLinkStorageV1 and following the naming convention
 * ReferralLinkVX.
 */
abstract contract ReferralLinkStorageV1 is IReferralLink {
    address public override signerWalletAddress;
    ISocialConnect public override socialConnect;
    address public override socialConnectIssuer;
    uint256 public override campaignsLength;
    mapping(uint256 => Campaign) internal _campaigns;
    EnumerableSet.AddressSet internal _verifiedUsers; // (receiver, sender) pair of a referralLink
}
