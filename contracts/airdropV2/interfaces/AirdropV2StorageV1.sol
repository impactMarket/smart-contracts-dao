// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./IAirdropV2.sol";

/**
 * @title Storage for Deposit
 * @notice For future upgrades, do not change DepositStorageV1. Create a new
 * contract which implements DepositStorageV1 and following the naming convention
 * DepositStorageVx.
 */
abstract contract AirdropV2StorageV1 is IAirdropV2 {
    IERC20 public override PACT;
    bytes32 public override merkleRoot;

    uint256 public override startTime;
    uint256 public override trancheAmount;
    uint256 public override totalAmount;
    uint256 public override cooldown;

    mapping(address => Beneficiary) public beneficiaries;
}
