// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

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
    IERC20 public override cUSD;
    ITreasury public override treasury;
    ICommunity public override communityTemplate;
    ProxyAdmin public override communityProxyAdmin;

    mapping(address => CommunityState) public override communities;
    EnumerableSet.AddressSet internal communityList;
}
