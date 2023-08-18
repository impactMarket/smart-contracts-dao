// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IMicrocredit.sol";

/**
 * @title Storage for Microcredit
 * @notice For future upgrades, do not change MicrocreditStorageV1. Create a new
 * contract which implements MicrocreditStorageV1 and following the naming convention
 * MicrocreditStorageVx.
 */
abstract contract MicrocreditStorageV1 is IMicrocredit {
    IERC20 public override cUSD;

    uint256 internal  _usersLength;
    mapping(uint256 => User) internal _users;

    mapping(address => WalletMetadata) internal _walletMetadata;
    EnumerableSet.AddressSet internal _walletList;

    EnumerableSet.AddressSet internal _managerList;
    address public override revenueAddress;

    mapping(address => Manager) public override managers;

    IDonationMiner public override donationMiner;
}
