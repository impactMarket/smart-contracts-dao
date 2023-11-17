// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./DonationMinerStorageV4.sol";

/**
 * @title Storage for DonationMiner
 * @notice For future upgrades, do not change DonationMinerStorageV5. Create a new
 * contract which implements DonationMinerStorageV4 and following the naming convention
 * DonationMinerStorageVX.
 */
abstract contract DonationMinerStorageV5 is DonationMinerStorageV4 {
    IAirdropV3 public override airdropV3;
    IMicrocredit public override microcredit;
    address public override recurringCronAddress;
}
