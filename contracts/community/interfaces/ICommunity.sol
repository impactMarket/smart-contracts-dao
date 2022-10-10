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
        uint256 claimedAmount;   //total amount of tokens received
                                 //(based on token ratios when there are more than one token)
        uint256 lastClaim;       //block number of the last claim
        mapping(address => uint256) claimedAmounts;
    }

    struct Token {
        address tokenAddress;    //address of the token
        uint256 ratio;           //ratio between maxClaim and previous token maxClaim
        uint256 startBlock;      //the number of the block from which the this token was "active"
    }

    function initialize(
        address _tokenAddress,
        address[] memory _managers,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        uint256 _minTranche,
        uint256 _maxTranche,
        uint256 _maxBeneficiaries,
        ICommunity _previousCommunity
    ) external;
    function getVersion() external pure returns(uint256);
    function previousCommunity() external view returns(ICommunity);
    function originalClaimAmount() external view returns(uint256);
    function claimAmount() external view returns(uint256);
    function baseInterval() external view returns(uint256);
    function incrementInterval() external view returns(uint256);
    function maxClaim() external view returns(uint256);
    function maxTotalClaim() external view returns(uint256);
    function validBeneficiaryCount() external view returns(uint);
    function maxBeneficiaries() external view returns(uint);
    function treasuryFunds() external view returns(uint);
    function privateFunds() external view returns(uint);
    function communityAdmin() external view returns(ICommunityAdmin);
    function cUSD() external view  returns(IERC20);
    function token() external view  returns(IERC20);
    function tokenList() external view returns(address[] memory);
    function locked() external view returns(bool);
    function beneficiaries(address _beneficiaryAddress) external view returns(
        BeneficiaryState state,
        uint256 claims,
        uint256 claimedAmount,
        uint256 lastClaim
    );
    function beneficiaryClaimedAmounts(address _beneficiaryAddress) external view
        returns (uint256[] memory claimedAmounts);
    function decreaseStep() external view returns(uint);
    function beneficiaryListAt(uint256 _index) external view returns (address);
    function beneficiaryListLength() external view returns (uint256);
    function minTranche() external view returns(uint256);
    function maxTranche() external view returns(uint256);
    function lastFundRequest() external view returns(uint256);
    function tokens(uint256 _index) external view returns (
        address tokenAddress,
        uint256 ratio,
        uint256 startBlock
    );
    function tokensLength() external view returns (uint256);
    function isSelfFunding() external view returns (bool);
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
    function updateMaxBeneficiaries(uint256 _newMaxBeneficiaries) external;
    function updateToken(
        IERC20 _newToken,
        address[] calldata _exchangePath,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external;
    function donate(address _sender, uint256 _amount) external;
    function addTreasuryFunds(uint256 _amount) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function addManager(address _managerAddress) external;
    function removeManager(address _managerAddress) external;
    function addBeneficiary(address _beneficiaryAddress) external;
    function addBeneficiaries(address[] memory _beneficiaryAddresses) external;
    function addBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external;
    function lockBeneficiary(address _beneficiaryAddress) external;
    function lockBeneficiaries(address[] memory _beneficiaryAddresses) external;
    function lockBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external;
    function unlockBeneficiary(address _beneficiaryAddress) external;
    function unlockBeneficiaries(address[] memory _beneficiaryAddresses) external;
    function unlockBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external;
    function removeBeneficiary(address _beneficiaryAddress) external;
    function removeBeneficiaries(address[] memory _beneficiaryAddresses) external;
    function removeBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external;
    function claim() external;
    function lastInterval(address _beneficiaryAddress) external view returns (uint256);
    function claimCooldown(address _beneficiaryAddress) external view returns (uint256);
    function lock() external;
    function unlock() external;
    function requestFunds() external;
    function beneficiaryJoinFromMigrated(address _beneficiaryAddress) external;
    function getInitialMaxClaim() external view returns (uint256);
}
