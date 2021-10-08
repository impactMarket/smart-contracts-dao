// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./Community.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

abstract contract CommunityAdminStorageV1 is ICommunityAdmin {
    address internal implementation;

    IERC20 internal _cUSD;
    ITreasury internal _treasury;
    ICommunity internal _communityTemplate;
    ProxyAdmin internal _communityProxyAdmin;
    uint256 internal _communityMinTranche;
    uint256 internal _communityMaxTranche;

    mapping(address => CommunityState) internal _communities;
    EnumerableSet.AddressSet internal _communityList;
}
