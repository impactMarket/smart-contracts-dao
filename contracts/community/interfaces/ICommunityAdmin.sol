// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";
import "../../token/interfaces/ITreasury.sol";

interface ICommunityAdmin {
    enum CommunityState {
        NONE,
        Valid,
        Removed,
        Migrated
    }

    function getVersion() external returns(uint256);
    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function communities(address community) external view returns(CommunityState);
    function communityTemplate() external view returns(ICommunity);
    function communityProxyAdmin() external view returns(ProxyAdmin);
    function communityListAt(uint256 index) external view returns (address);
    function communityListLength() external view returns (uint256);

    function updateTreasury(ITreasury newTreasury) external;
    function updateCommunityTemplate(ICommunity communityTemplate_) external;
    function updateBeneficiaryParams(
        ICommunity community,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval
    ) external;
    function updateCommunityParams(
        ICommunity community,
        uint256 minTranche,
        uint256 maxTranche
    ) external;
    function updateProxyImplementation(address communityProxy, address newLogic) external;
    function addCommunity(
        address[] memory managers,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval,
        uint256 minTranche,
        uint256 maxTranche
    ) external;
    function migrateCommunity(
        address[] memory managers,
        ICommunity previousCommunity
    ) external;
    function addManagerToCommunity(ICommunity community_, address account_) external;
    function removeCommunity(ICommunity community) external;
    function fundCommunity() external;
    function transfer(IERC20 token, address to, uint256 amount) external;
    function transferFromCommunity(ICommunity community, IERC20 token, address to, uint256 amount) external;
}
