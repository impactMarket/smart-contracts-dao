// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

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
        address[] memory managers,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval,
        uint256 minTranche,
        uint256 maxTranche,
        ICommunity previousCommunity
    ) external;
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
    function beneficiaries(address beneficiaryAddress) external view returns(
        BeneficiaryState state,
        uint256 claims,
        uint256 claimedAmount,
        uint256 lastClaim
    );
    function decreaseStep() external view returns(uint);
    function beneficiaryList(uint256 index) external view returns (address);
    function beneficiaryListLength() external view returns (uint256);
    function impactMarketAddress() external pure returns (address);
    function minTranche() external view returns(uint256);
    function maxTranche() external view returns(uint256);

    function updateCommunityAdmin(ICommunityAdmin communityAdmin) external;
    function updatePreviousCommunity(ICommunity newPreviousCommunity) external;
    function updateBeneficiaryParams(
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval
    ) external;
    function updateCommunityParams(
        uint256 minTranche,
        uint256 maxTranche
    ) external;
    function donate(address sender, uint256 amount) external;
    function addTreasuryFunds(uint256 amount) external;
    function transfer(IERC20 token, address to, uint256 amount) external;
    function addManager(address managerAddress) external;
    function removeManager(address managerAddress) external;
    function addBeneficiary(address beneficiaryAddress) external;
    function lockBeneficiary(address beneficiaryAddress) external;
    function unlockBeneficiary(address beneficiaryAddress) external;
    function removeBeneficiary(address beneficiaryAddress) external;
    function claim() external;
    function lastInterval(address beneficiaryAddress) external view returns (uint256);
    function claimCooldown(address beneficiaryAddress) external view returns (uint256);
    function lock() external;
    function unlock() external;
    function requestFunds() external;
    function beneficiaryJoinFromMigrated() external;
    function getInitialMaxClaim() external view returns (uint256);
}
