// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "./ICommunityAdmin.sol";
import "../../token/interfaces/ITreasury.sol";

/**
 * @title Storage for CommunityAdmin
 * @notice For future upgrades, do not change CommunityAdminStorageV1. Create a new
 * contract which implements CommunityAdminStorageV1 and following the naming convention
 * CommunityAdminStorageVX.
 */
abstract contract CommunityAdminStorageV1 is ICommunityAdmin {
    IERC20 internal _cUSD;
    ITreasury internal _treasury;
    ICommunity internal _communityTemplate;
    ProxyAdmin internal _communityProxyAdmin;

    mapping(address => CommunityState) internal _communities;
    EnumerableSet.AddressSet internal _communityList;
}
