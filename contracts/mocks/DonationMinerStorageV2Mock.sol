//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "../token/interfaces/DonationMinerStorageV1.sol";

//used only for testing
abstract contract DonationMinerStorageV2Mock is DonationMinerStorageV1 {
    uint256 public testParam1;
    address public testParam2;
    mapping(uint256 => uint256) public testParam3;
    mapping(address => uint256) public testParam4;
}
