// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityAdmin.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to the Community contract. For each community
 * there will be one contract like this being deployed by
 * CommunityAdmin contract. This enable us to save tokens on the
 * contract itself, and avoid the problems of having everything
 * in one single contract. Each community has it's own members and
 * and managers.
 */
contract Community is ICommunity, AccessControl, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant DEFAULT_AMOUNT = 5e16;
    uint256 public constant VERSION = 1;

    bool private _locked;
    uint256 private _claimAmount;
    uint256 private _baseInterval;
    uint256 private _incrementInterval;
    uint256 private _maxClaim;
    uint256 private _validBeneficiaryCount;
    uint256 private _treasuryFunds;
    uint256 private _privateFunds;
    uint256 private _decreaseStep = 1e16;

    ICommunity private _previousCommunity;
    ICommunityAdmin private _communityAdmin;

    mapping(address => Beneficiary) private _beneficiaries;
    EnumerableSet.AddressSet private _beneficiaryList;

    event ManagerAdded(address indexed _account);
    event ManagerRemoved(address indexed _account);
    event BeneficiaryAdded(address indexed _account);
    event BeneficiaryLocked(address indexed _account);
    event BeneficiaryUnlocked(address indexed _account);
    event BeneficiaryRemoved(address indexed _account);
    event BeneficiaryClaim(address indexed _account, uint256 _amount);
    event CommunityEdited(
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    );
    event CommunityLocked(address indexed _by);
    event CommunityUnlocked(address indexed _by);
    event MigratedFunds(address indexed _to, uint256 _amount);

    /**
     * @dev Constructor with custom fields, choosen by the community.
     * @param firstManager_ Comminuty's first manager. Will
     * be able to add others.
     * @param claimAmount_ Base amount to be claim by the benificiary.
     * @param maxClaim_ Limit that a beneficiary can claim at once.
     * @param baseInterval_ Base interval to start claiming.
     * @param incrementInterval_ Increment interval used in each claim.
     * @param previousCommunity_ previous smart contract address of community.
     */
    constructor(
        address firstManager_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        ICommunity previousCommunity_,
        ICommunityAdmin communityAdmin_
    ) {
        require(
            baseInterval_ > incrementInterval_,
            "Community::constructor: baseInterval must be greater than incrementInterval"
        );
        require(
            maxClaim_ > claimAmount_,
            "Community::constructor: maxClaim must be greater than claimAmount"
        );

        _setupRole(MANAGER_ROLE, firstManager_);
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);
        emit ManagerAdded(firstManager_);

        _claimAmount = claimAmount_;
        _baseInterval = baseInterval_;
        _incrementInterval = incrementInterval_;
        _maxClaim = maxClaim_;
        _previousCommunity = previousCommunity_;
        _communityAdmin = communityAdmin_;
        _locked = false;

        transferOwnership(address(communityAdmin_));
    }

    modifier onlyValidBeneficiary() {
        require(
            _beneficiaries[msg.sender].state == BeneficiaryState.Valid,
            "Community: NOT_VALID_BENEFICIARY"
        );
        _;
    }

    modifier onlyManagers() {
        require(hasRole(MANAGER_ROLE, msg.sender), "Community: NOT_MANAGER");
        _;
    }

    function previousCommunity() external view override returns (ICommunity) {
        return _previousCommunity;
    }

    function claimAmount() external view override returns (uint256) {
        return _claimAmount;
    }

    function baseInterval() external view override returns (uint256) {
        return _baseInterval;
    }

    function incrementInterval() external view override returns (uint256) {
        return _incrementInterval;
    }

    function maxClaim() external view override returns (uint256) {
        return _maxClaim;
    }

    function validBeneficiaryCount() external view override returns (uint256) {
        return _validBeneficiaryCount;
    }

    function treasuryFunds() external view override returns (uint256) {
        return _treasuryFunds;
    }

    function privateFunds() external view override returns (uint256) {
        return _privateFunds;
    }

    function communityAdmin() external view override returns (ICommunityAdmin) {
        return _communityAdmin;
    }

    function cUSD() public view override returns (IERC20) {
        return _communityAdmin.cUSD();
    }

    function locked() external view override returns (bool) {
        return _locked;
    }

    function beneficiaries(address beneficiary_)
        external
        view
        override
        returns (Beneficiary memory)
    {
        return _beneficiaries[beneficiary_];
    }

    function decreaseStep() external view override returns (uint256) {
        return _decreaseStep;
    }

    function beneficiaryList(uint256 index) external view override returns (address) {
        return _beneficiaryList.at(index);
    }

    function beneficiaryListLength() external view override returns (uint256) {
        return _beneficiaryList.length();
    }

    // only used for backwards compatibility
    function impactMarketAddress() external pure override returns (address) {
        return address(0);
    }

    /**
     * @dev Allow community managers to add other managers.
     */
    function addManager(address _account) external override onlyManagers {
        grantRole(MANAGER_ROLE, _account);
        emit ManagerAdded(_account);
    }

    /**
     * @dev Allow community managers to remove other managers.
     */
    function removeManager(address _account) external override onlyManagers {
        revokeRole(MANAGER_ROLE, _account);
        emit ManagerRemoved(_account);
    }

    /**
     * @dev Allow community managers to add beneficiaries.
     */
    function addBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = _beneficiaries[beneficiaryAddress_];
        require(beneficiary.state == BeneficiaryState.NONE, "Community::addBeneficiary: NOT_YET");
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Valid);
        // solhint-disable-next-line not-rely-on-time
        beneficiary.lastClaim = block.timestamp;

        // send default amount when adding a new beneficiary
        bool success = cUSD().transfer(beneficiaryAddress_, DEFAULT_AMOUNT);
        require(success, "Community::addBeneficiary: NOT_ALLOWED");

        _beneficiaryList.add(beneficiaryAddress_);

        emit BeneficiaryAdded(beneficiaryAddress_);
    }

    /**
     * @dev Allow community managers to lock beneficiaries.
     */
    function lockBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = _beneficiaries[beneficiaryAddress_];

        require(beneficiary.state == BeneficiaryState.Valid, "Community::lockBeneficiary: NOT_YET");
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Locked);
        emit BeneficiaryLocked(beneficiaryAddress_);
    }

    /**
     * @dev Allow community managers to unlock locked beneficiaries.
     */
    function unlockBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = _beneficiaries[beneficiaryAddress_];

        require(
            beneficiary.state == BeneficiaryState.Locked,
            "Community::unlockBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Valid);
        emit BeneficiaryUnlocked(beneficiaryAddress_);
    }

    /**
     * @dev Allow community managers to remove beneficiaries.
     */
    function removeBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = _beneficiaries[beneficiaryAddress_];

        require(
            beneficiary.state == BeneficiaryState.Valid ||
                beneficiary.state == BeneficiaryState.Locked,
            "Community::removeBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Removed);
        emit BeneficiaryRemoved(beneficiaryAddress_);
    }

    /**
     * @dev Allow beneficiaries to claim.
     */
    function claim() external override onlyValidBeneficiary {
        Beneficiary storage beneficiary = _beneficiaries[msg.sender];

        require(!_locked, "LOCKED");
        // solhint-disable-next-line not-rely-on-time
        require(claimCooldown(msg.sender) <= block.timestamp, "Community::claim: NOT_YET");
        require(
            (beneficiary.claimedAmount + _claimAmount) <= _maxClaim,
            "Community::claim: MAX_CLAIM"
        );

        beneficiary.claimedAmount += _claimAmount;
        beneficiary.claims++;
        beneficiary.lastClaim = block.timestamp;

        bool success = cUSD().transfer(msg.sender, _claimAmount);
        require(success, "Community::claim: NOT_ALLOWED");
        emit BeneficiaryClaim(msg.sender, _claimAmount);
    }

    function lastInterval(address beneficiaryAddress_) public view override returns (uint256) {
        Beneficiary storage beneficiary = _beneficiaries[beneficiaryAddress_];
        if (beneficiary.claims == 0) {
            return 0;
        }
        return _baseInterval + (beneficiary.claims - 1) * _incrementInterval;
    }

    function claimCooldown(address beneficiaryAddress_) public view override returns (uint256) {
        return _beneficiaries[beneficiaryAddress_].lastClaim + lastInterval(beneficiaryAddress_);
    }

    /**
     * @dev Allow community managers to edit community variables.
     */
    function edit(
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_
    ) external override onlyOwner {
        require(
            baseInterval_ > incrementInterval_,
            "Community::constructor: baseInterval must be greater than incrementInterval"
        );
        require(
            maxClaim_ > claimAmount_,
            "Community::constructor: maxClaim must be greater than claimAmount"
        );

        _claimAmount = claimAmount_;
        _maxClaim = maxClaim_;
        _decreaseStep = decreaseStep_;
        _baseInterval = baseInterval_;
        _incrementInterval = incrementInterval_;

        emit CommunityEdited(
            _claimAmount,
            _maxClaim,
            _decreaseStep,
            _baseInterval,
            _incrementInterval
        );
    }

    /**
     * Allow community managers to lock community claims.
     */
    function lock() external override onlyManagers {
        _locked = true;
        emit CommunityLocked(msg.sender);
    }

    /**
     * Allow community managers to unlock community claims.
     */
    function unlock() external override onlyManagers {
        _locked = false;
        emit CommunityUnlocked(msg.sender);
    }

    function requestFunds() external override onlyManagers {
        _communityAdmin.fundCommunity();
    }

    /**
     * Migrate funds in current community to new one.
     */
    function migrateFunds(ICommunity newCommunity_, address newCommunityManager_)
        external
        override
        onlyOwner
    {
        require(
            newCommunity_.hasRole(MANAGER_ROLE, newCommunityManager_) == true,
            "Community::migrateFunds: NOT_ALLOWED"
        );
        require(newCommunity_.previousCommunity() == this, "Community::migrateFunds: NOT_ALLOWED");
        uint256 balance = cUSD().balanceOf(address(this));
        bool success = cUSD().transfer(address(newCommunity_), balance);
        require(success, "Community::migrateFunds: NOT_ALLOWED");
        emit MigratedFunds(address(newCommunity_), balance);
    }

    function donate(address sender_, uint256 amount_) external override {
        cUSD().safeTransferFrom(sender_, address(this), amount_);
        _privateFunds += amount_;
    }

    function addTreasuryFunds(uint256 _amount) external override onlyOwner {
        _treasuryFunds += _amount;
    }

    function transferFunds(
        IERC20 erc20_,
        address to_,
        uint256 amount_
    ) external override onlyOwner {
        erc20_.safeTransfer(to_, amount_);
    }

    function beneficiaryJoinFromMigrated() external override {
        // no need to check if it's a beneficiary, as the state is copied
        Beneficiary storage beneficiary = _beneficiaries[msg.sender];

        Beneficiary memory oldBeneficiary = _previousCommunity.beneficiaries(msg.sender);

        _changeBeneficiaryState(beneficiary, oldBeneficiary.state);
        beneficiary.lastClaim = oldBeneficiary.lastClaim;
        beneficiary.claimedAmount = oldBeneficiary.claimedAmount;
        beneficiary.claims =
            (_previousCommunity.lastInterval(msg.sender) - _baseInterval) /
            _incrementInterval +
            1;

        if (beneficiary.state == BeneficiaryState.NONE) {
            _beneficiaryList.add(msg.sender);
        }
    }

    function managerJoinFromMigrated() external override {
        require(_previousCommunity.hasRole(MANAGER_ROLE, msg.sender), "NOT_ALLOWED");
        grantRole(MANAGER_ROLE, msg.sender);
    }

    function _changeBeneficiaryState(Beneficiary storage beneficiary, BeneficiaryState newState_)
        internal
    {
        if (beneficiary.state == newState_) {
            return;
        }

        if (newState_ == BeneficiaryState.Valid) {
            _validBeneficiaryCount++;
            _claimAmount -= _decreaseStep;
        } else if (beneficiary.state == BeneficiaryState.Valid) {
            _validBeneficiaryCount--;
            _claimAmount += _decreaseStep;
        }

        beneficiary.state = newState_;
    }
}
