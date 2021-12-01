// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../community/interfaces/ICommunity.sol";
import "../community/interfaces/ICommunityAdmin.sol";
import "../community/interfaces/CommunityStorageV1.sol";

/**
 * @title Storage for Community
 * @notice For future upgrades, do not change CommunityStorageV1. Create a new
 * contract which implements CommunityStorageV1 and following the naming convention
 * CommunityStorageVX.
 */
abstract contract CommunityStorageV2Mock is CommunityStorageV1 {
    address addressTest1;
    address addressTest2;
    address addressTest3;
    uint256 uint256Test1;
    uint256 uint256Test2;
    uint256 uint256Test3;

    mapping(bytes32 => bytes32) private mapTest1;
    mapping(bytes32 => bytes32) private mapTest2;
    mapping(bytes32 => bytes32) private mapTest3;
}
