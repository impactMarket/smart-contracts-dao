// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IAmbassadors.sol";
import "../../community/interfaces/ICommunityAdmin.sol";

/**
 * @title Storage for Ambassadors
 * @notice For future upgrades, do not change AmbassadorsStorageV1. Create a new
 * contract which implements AmbassadorsStorageV1 and following the naming convention
 * AmbassadorsStorageVX.
 */
abstract contract AmbassadorsStorageV1 is IAmbassadors {
    uint256 public ambassadorIndex;
    uint256 public entityIndex;

    ICommunityAdmin public communityAdmin;
    // address to index
    mapping(address => uint256) public ambassadorByAddress;
    // index to address
    mapping(uint256 => address) public ambassadorByIndex;
    // communities an ambassador is responsible for
    mapping(uint256 => EnumerableSet.AddressSet) internal ambassadorCommunities;
    // community address to ambassador index
    mapping(address => uint256) public communityToAmbassador;
    // ambassador belongs to entity
    mapping(uint256 => uint256) public ambassadorToEntity;
    // entity adding ambassadors
    mapping(address => uint256) public entityByAddress;
    // entity adding ambassadors
    mapping(uint256 => address) public entityByIndex;
    // number of ambassadors an entity is responsible for
    mapping(uint256 => uint256) public entityAmbassadors;
}
