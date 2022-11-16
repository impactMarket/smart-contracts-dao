// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./ICommunity.sol";
import "../../treasury/interfaces/ITreasury.sol";

interface ICommunityAdmin {
    enum CommunityState {
        NONE,
        Valid,
        Removed,
        Migrated
    }

    function getVersion() external pure returns(uint256);
    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function communities(address _community) external view returns(CommunityState);
    function communityTemplate() external view returns(ICommunity);
    function communityProxyAdmin() external view returns(ProxyAdmin);
    function communityListAt(uint256 _index) external view returns (address);
    function communityListLength() external view returns (uint256);

    function updateTreasury(ITreasury _newTreasury) external;
    function updateCommunityTemplate(ICommunity _communityTemplate_) external;
    function updateBeneficiaryParams(
        ICommunity _community,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external;
    function updateCommunityParams(
        ICommunity _community,
        uint256 _minTranche,
        uint256 _maxTranche
    ) external;
    function updateProxyImplementation(address _communityProxy, address _newLogic) external;
    function addCommunity(
        address[] memory _managers,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        uint256 _minTranche,
        uint256 _maxTranche
    ) external;
    function migrateCommunity(
        address[] memory _managers,
        ICommunity _previousCommunity
    ) external;
    function addManagerToCommunity(ICommunity _community_, address _account_) external;
    function removeCommunity(ICommunity _community) external;
    function fundCommunity() external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function transferFromCommunity(
        ICommunity _community,
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external;
}
