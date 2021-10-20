// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";
import "../../token/interfaces/ITreasury.sol";

interface ICommunityAdmin {
    enum CommunityState {
        NONE,
        Valid,
        Removed
    }
    function initialize(
        ICommunity communityTemplate,
        IERC20 cUSD,
        uint256 communityMinTranche,
        uint256 communityMaxTranche
    ) external;

    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function communities(address community) external view returns(CommunityState);
    function communityMinTranche() external view returns(uint256);
    function communityMaxTranche() external view returns(uint256);
    function communityList(uint256 index) external view returns (address);
    function communityListLength() external view returns (uint256);

    function setTreasury(ITreasury newTreasury) external;
    function setCommunityTemplate(ICommunity communityTemplate_) external;
    function editCommunityTrancheLimits(uint256 newCommunityMinTranche, uint256 newCommunityMaxTranche) external;
    function addCommunity(
        address firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval
    ) external returns(address);
    function migrateCommunity(address firstManager, ICommunity previousCommunity) external;
    function removeCommunity(ICommunity community) external;
    function fundCommunity() external;
    function transfer(IERC20 token, address to, uint256 amount) external;
    function transferFromCommunity(ICommunity community, IERC20 erc20, address to, uint256 amount) external;
    function editCommunity(
        ICommunity community,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval
    ) external;
    function updateProxyImplementation(address communityProxy, address newLogic) external;
}





