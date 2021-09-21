// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";
import "./ICommunityAdminHelper.sol";
import "../../token/interfaces/ITreasury.sol";

interface ICommunityAdmin {
    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function communityAdminHelper() external view returns(ICommunityAdminHelper);
    function communities(address community) external view returns(bool);
    function communityMinTranche() external view returns(uint256);
    function communityMaxTranche() external view returns(uint256);

    function setTreasury(ITreasury newTreasury) external;
    function setCommunityMinTranche(uint256 newCommunityMinTranche) external;
    function setCommunityMaxTranche(uint256 newCommunityMaxTranche) external;
    function addCommunity(
        address firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval
    ) external;
    function migrateCommunity(
        address firstManager,
        ICommunity previousCommunity,
        ICommunityAdminHelper newCommunityAdminHelper
    ) external;
    function removeCommunity(ICommunity community) external;
    function setCommunityAdminHelper(ICommunityAdminHelper communityAdminHelper) external;
    function initCommunityAdminHelper(ICommunityAdminHelper communityAdminHelper) external;
    function fundCommunity() external;
    function transfer(IERC20 erc20, address to, uint256 amount) external;
    function transferFromCommunity(ICommunity community, IERC20 erc20, address to, uint256 amount) external;
}





