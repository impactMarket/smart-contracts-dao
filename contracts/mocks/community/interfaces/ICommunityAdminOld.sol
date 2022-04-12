// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunityOld.sol";
import "../../../treasury/interfaces/ITreasury.sol";

interface ICommunityAdminOld {
    enum CommunityState {
        NONE,
        Valid,
        Removed,
        Migrated
    }

    function getVersion() external returns(uint256);
    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function communities(address _community) external view returns(CommunityState);
    function communityImplementation() external view returns(ICommunityOld);
    function communityProxyAdmin() external view returns(ProxyAdmin);
    function communityListAt(uint256 _index) external view returns (address);
    function communityListLength() external view returns (uint256);

    function updateTreasury(ITreasury _newTreasury) external;
    function updateCommunityImplementation(ICommunityOld _communityImplementation_) external;
    function updateBeneficiaryParams(
        ICommunityOld _community,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external;
    function updateCommunityParams(
        ICommunityOld _community,
        uint256 _minTranche,
        uint256 _maxTranche
    ) external;
    function updateProxyImplementation(address _CommunityMiddleProxy, address _newLogic) external;
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
        ICommunityOld _previousCommunity
    ) external;
    function addManagerToCommunity(ICommunityOld _community_, address _account_) external;
    function removeCommunity(ICommunityOld _community) external;
    function fundCommunity() external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function transferFromCommunity(
        ICommunityOld _community,
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external;
}
