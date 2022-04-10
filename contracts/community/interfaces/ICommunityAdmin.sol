// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";
import "../../treasury/interfaces/ITreasury.sol";
import "../../governor/ubiCommittee/interfaces/IUBICommittee.sol";
import "../../ambassadors/interfaces/IAmbassadors.sol";

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
    function ubiCommittee() external view returns(IUBICommittee);
    function ambassadors() external view returns(IAmbassadors);
    function communities(address _community) external view returns(CommunityState);
    function communityTemplate() external view returns(ICommunity);
    function communityProxyAdmin() external view returns(ProxyAdmin);
    function communityListAt(uint256 _index) external view returns (address);
    function communityListLength() external view returns (uint256);
    function isAmbassadorOfCommunity(address _community, address _ambassador) external view returns (bool);

    function updateTreasury(ITreasury _newTreasury) external;
    function updateUbiCommittee(IUBICommittee _newUbiCommittee) external;
    function updateAmbassadors(IAmbassadors _newAmbassadors) external;
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
        address _ambassador,
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
