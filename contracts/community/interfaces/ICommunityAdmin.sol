// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./ICommunity.sol";
import "../../treasury/interfaces/ITreasury.sol";
import "../../governor/impactMarketCouncil/interfaces/IImpactMarketCouncil.sol";
import "../../ambassadors/interfaces/IAmbassadors.sol";

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
    function impactMarketCouncil() external view returns(IImpactMarketCouncil);
    function ambassadors() external view returns(IAmbassadors);
    function communityMiddleProxy() external view returns(address);
    function authorizedWalletAddress() external view returns(address);
    function minClaimAmountRatio() external view returns(uint256);
    function minClaimAmountRatioPrecision() external view returns(uint256);
    function communities(address _community) external view returns(CommunityState);
    function communityImplementation() external view returns(ICommunity);
    function communityProxyAdmin() external view returns(ProxyAdmin);
    function communityListAt(uint256 _index) external view returns (address);
    function communityListLength() external view returns (uint256);
    function treasurySafetyPercentage() external view returns (uint256);
    function treasuryMinBalance() external view returns (uint256);
    function isAmbassadorOrEntityOfCommunity(address _community, address _ambassadorOrEntity) external view returns (bool);
    function updateTreasury(ITreasury _newTreasury) external;
    function updateImpactMarketCouncil(IImpactMarketCouncil _newImpactMarketCouncil) external;
    function updateAmbassadors(IAmbassadors _newAmbassadors) external;
    function updateCommunityMiddleProxy(address _communityMiddleProxy) external;
    function updateCommunityImplementation(ICommunity _communityImplementation_) external;
    function updateAuthorizedWalletAddress(address _newSignerAddress) external;
    function updateMinClaimAmountRatio(uint256 _newMinClaimAmountRatio) external;
    function updateTreasurySafetyPercentage(uint256 _newTreasurySafetyPercentage) external;
    function updateTreasuryMinBalance(uint256 _newTreasuryMinBalance) external;
    function setCommunityToAmbassador(address _ambassador, ICommunity _communityAddress) external;
    function updateBeneficiaryParams(
        ICommunity _community,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        uint256 _maxBeneficiaries
    ) external;
    function updateCommunityParams(
        ICommunity _community,
        uint256 _minTranche,
        uint256 _maxTranche
    ) external;
    function updateProxyImplementation(address _communityMiddleProxy, address _newLogic) external;
    function updateCommunityToken(
        ICommunity _community,
        IERC20 _newToken,
        bytes memory _exchangePath,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external;
    function addCommunity(
        address _tokenAddress,
        address[] memory _managers,
        address _ambassador,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        uint256 _minTranche,
        uint256 _maxTranche,
        uint256 _maxBeneficiaries
    ) external;
    function migrateCommunity(
        address[] memory _managers,
        ICommunity _previousCommunity
    ) external;
    function splitCommunity(
        ICommunity _community,
        uint256 _numberOfCopies,
        address _ambassador,
        address[] memory _managers
    ) external;
    function removeCommunity(ICommunity _community) external;
    function fundCommunity() external returns(uint256);
    function transferToBeneficiary(IERC20 _token, address beneficiary, uint256 amount) external;
    function calculateCommunityTrancheAmount(ICommunity _community) external view returns (uint256);
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function transferFromCommunity(
        ICommunity _community,
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external;
    function getCommunityProxyImplementation(address _communityProxyAddress) external view returns(address);
}
