// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./IDeposit.sol";

/**
 * @title Storage for Deposit
 * @notice For future upgrades, do not change DepositStorageV1. Create a new
 * contract which implements DepositStorageV1 and following the naming convention
 * DepositStorageVx.
 */
abstract contract DepositStorageV1 is IDeposit {
    ITreasury public override treasury;
    IDonationMiner public override donationMiner;
    ILendingPool public override lendingPool;
    EnumerableSet.AddressSet internal _tokenList;
    mapping(address => Token) internal _tokens;
}
