// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunityAdmin.sol";

interface ICommunity {
    enum BeneficiaryState {
        NONE, //the beneficiary hasn't been added yet
        Valid,
        Locked,
        Removed
    }

    struct Beneficiary {
        BeneficiaryState state;  //beneficiary state
        uint256 claims;          //total number of claims
        uint256 claimedAmount;   //total amount of cUSD received
        uint256 lastClaim;       //block number of the last claim
    }

    function initialize(
        address[] memory _managers,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        uint256 _minTranche,
        uint256 _maxTranche,
        ICommunity _previousCommunity
    ) external;
    function getVersion() external returns(uint256);
    function previousCommunity() external view returns(ICommunity);
    function claimAmount() external view returns(uint256);
    function baseInterval() external view returns(uint256);
    function incrementInterval() external view returns(uint256);
    function maxClaim() external view returns(uint256);
    function validBeneficiaryCount() external view returns(uint);
    function treasuryFunds() external view returns(uint);
    function privateFunds() external view returns(uint);
    function communityAdmin() external view returns(ICommunityAdmin);
    function cUSD() external view  returns(IERC20);
    function locked() external view returns(bool);
    function beneficiaries(address _beneficiaryAddress) external view returns(
        BeneficiaryState state,
        uint256 claims,
        uint256 claimedAmount,
        uint256 lastClaim
    );
    function decreaseStep() external view returns(uint);
    function beneficiaryListAt(uint256 _index) external view returns (address);
    function beneficiaryListLength() external view returns (uint256);
    function impactMarketAddress() external pure returns (address);
    function minTranche() external view returns(uint256);
    function maxTranche() external view returns(uint256);
    function lastFundRequest() external view returns(uint256);

    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function updatePreviousCommunity(ICommunity _newPreviousCommunity) external;
    function updateBeneficiaryParams(
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external;
    function updateCommunityParams(
        uint256 _minTranche,
        uint256 _maxTranche
    ) external;
    function donate(address _sender, uint256 _amount) external;
    function addTreasuryFunds(uint256 _amount) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function addManager(address _managerAddress) external;
    function removeManager(address _managerAddress) external;
    function addBeneficiaries(address[] memory _beneficiaryAddresses) external;
    function lockBeneficiary(address _beneficiaryAddress) external;
    function unlockBeneficiary(address _beneficiaryAddress) external;
    function removeBeneficiary(address _beneficiaryAddress) external;
    function claim() external;
    function lastInterval(address _beneficiaryAddress) external view returns (uint256);
    function claimCooldown(address _beneficiaryAddress) external view returns (uint256);
    function lock() external;
    function unlock() external;
    function requestFunds() external;
    function beneficiaryJoinFromMigrated(address _beneficiaryAddress) external;
    function getInitialMaxClaim() external view returns (uint256);
}
