// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./ITreasury.sol";
import "./TreasuryStorageV1.sol";

/**
 * @title Storage for Treasury
 * @notice For future upgrades, do not change TreasuryStorageV2. Create a new
 * contract which implements TreasuryStorageV2 and following the naming convention
 * TreasuryStorageVX.
 */
abstract contract TreasuryStorageV2 is TreasuryStorageV1 {
    IDonationMiner public override donationMiner;
    ITreasuryLpSwap public override lpSwap;
    mapping(address => Token) public override tokens;
    EnumerableSet.AddressSet internal _tokenList;
    IERC20 public override PACT;
    uint256 public override lpPercentage;
}
