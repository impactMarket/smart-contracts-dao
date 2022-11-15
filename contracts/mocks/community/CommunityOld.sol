// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityOld.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./interfaces/CommunityStorageV1.sol";

/**
 * @notice Welcome to the Community contract. For each community
 * there will be one proxy contract deployed by CommunityAdmin.
 * The implementation of the proxy is this contract. This enable
 * us to save tokens on the contract itself, and avoid the problems
 * of having everything in one single contract.
 *Each community has it's own members and and managers.
 */
contract CommunityOld is
    Initializable,
    AccessControlUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    CommunityStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 private constant DEFAULT_AMOUNT = 5e16;

    /**
     * @notice Triggered when a manager has been added
     *
     * @param manager           Address of the manager that triggered the event
     *                          or address of the CommunityAdmin if it's first manager
     * @param account           Address of the manager that has been added
     */
    event ManagerAdded(address indexed manager, address indexed account);

    /**
     * @notice Triggered when a manager has been removed
     *
     * @param manager           Address of the manager that triggered the event
     * @param account           Address of the manager that has been removed
     */
    event ManagerRemoved(address indexed manager, address indexed account);

    /**
     * @notice Triggered when a beneficiary has been added
     *
     * @param manager           Address of the manager that triggered the event
     * @param beneficiary       Address of the beneficiary that has been added
     */
    event BeneficiaryAdded(address indexed manager, address indexed beneficiary);

    /**
     * @notice Triggered when a beneficiary has been locked
     *
     * @param manager           Address of the manager that triggered the event
     * @param beneficiary       Address of the beneficiary that has been locked
     */
    event BeneficiaryLocked(address indexed manager, address indexed beneficiary);

    /**
     * @notice Triggered when a beneficiary has been unlocked
     *
     * @param manager           Address of the manager that triggered the event
     * @param beneficiary       Address of the beneficiary that has been unlocked
     */
    event BeneficiaryUnlocked(address indexed manager, address indexed beneficiary);

    /**
     * @notice Triggered when a beneficiary has been removed
     *
     * @param manager           Address of the manager that triggered the event
     * @param beneficiary       Address of the beneficiary that has been removed
     */
    event BeneficiaryRemoved(address indexed manager, address indexed beneficiary);

    /**
     * @notice Triggered when a beneficiary has claimed
     *
     * @param beneficiary       Address of the beneficiary that has claimed
     * @param amount            Amount of the claim
     */
    event BeneficiaryClaim(address indexed beneficiary, uint256 amount);

    /**
     * @notice Triggered when a community has been locked
     *
     * @param manager           Address of the manager that triggered the event
     */
    event CommunityLocked(address indexed manager);

    /**
     * @notice Triggered when a community has been unlocked
     *
     * @param manager           Address of the manager that triggered the event
     */
    event CommunityUnlocked(address indexed manager);

    /**
     * @notice Triggered when a manager has requested funds for community
     *
     * @param manager           Address of the manager that triggered the event
     */
    event FundsRequested(address indexed manager);

    /**
     * @notice Triggered when someone has donated cUSD
     *
     * @param donor             Address of the donor
     * @param amount            Amount of the donation
     */
    event Donate(address indexed donor, uint256 amount);

    /**
     * @notice Triggered when a beneficiary from previous community has joined in the current community
     *
     * @param beneficiary       Address of the beneficiary
     */
    event BeneficiaryJoined(address indexed beneficiary);

    /**
     * @notice Triggered when beneficiary params has been updated
     *
     * @param oldClaimAmount       Old claimAmount value
     * @param oldMaxClaim          Old maxClaim value
     * @param oldDecreaseStep      Old decreaseStep value
     * @param oldBaseInterval      Old baseInterval value
     * @param oldIncrementInterval Old incrementInterval value
     * @param newClaimAmount       New claimAmount value
     * @param newMaxClaim          New maxClaim value
     * @param newDecreaseStep      New decreaseStep value
     * @param newBaseInterval      New baseInterval value
     * @param newIncrementInterval New incrementInterval value
     *
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    event BeneficiaryParamsUpdated(
        uint256 oldClaimAmount,
        uint256 oldMaxClaim,
        uint256 oldDecreaseStep,
        uint256 oldBaseInterval,
        uint256 oldIncrementInterval,
        uint256 newClaimAmount,
        uint256 newMaxClaim,
        uint256 newDecreaseStep,
        uint256 newBaseInterval,
        uint256 newIncrementInterval
    );

    /**
     * @notice Triggered when community params has been updated
     *
     * @param oldMinTranche        Old minTranche value
     * @param oldMaxTranche        Old maxTranche value
     * @param newMinTranche        New minTranche value
     * @param newMaxTranche        New maxTranche value
     *
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    event CommunityParamsUpdated(
        uint256 oldMinTranche,
        uint256 oldMaxTranche,
        uint256 newMinTranche,
        uint256 newMaxTranche
    );

    /**
     * @notice Triggered when communityAdmin has been updated
     *
     * @param oldCommunityAdmin   Old communityAdmin address
     * @param newCommunityAdmin   New communityAdmin address
     */
    event CommunityAdminUpdated(
        address indexed oldCommunityAdmin,
        address indexed newCommunityAdmin
    );

    /**
     * @notice Triggered when previousCommunity has been updated
     *
     * @param oldPreviousCommunity   Old previousCommunity address
     * @param newPreviousCommunity   New previousCommunity address
     */
    event PreviousCommunityUpdated(
        address indexed oldPreviousCommunity,
        address indexed newPreviousCommunity
    );

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Used to initialize a new Community contract
     *
     * @param _managers            Community's initial managers.
     *                             Will be able to add others
     * @param _claimAmount         Base amount to be claim by the beneficiary
     * @param _maxClaim            Limit that a beneficiary can claim in total
     * @param _decreaseStep        Value decreased from maxClaim each time a beneficiary is added
     * @param _baseInterval        Base interval to start claiming
     * @param _incrementInterval   Increment interval used in each claim
     * @param _previousCommunity   Previous smart contract address of community
     * @param _minTranche          Minimum amount that the community will receive when requesting funds
     * @param _maxTranche          Maximum amount that the community will receive when requesting funds
     */
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
    ) external initializer {
        require(
            _baseInterval > _incrementInterval,
            "Community::initialize: baseInterval must be greater than incrementInterval"
        );
        require(
            _maxClaim > _claimAmount,
            "Community::initialize: maxClaim must be greater than claimAmount"
        );

        require(
            _minTranche <= _maxTranche,
            "Community::initialize: minTranche should not be greater than maxTranche"
        );

        __AccessControl_init();
        __Ownable_init();
        __ReentrancyGuard_init();

        claimAmount = _claimAmount;
        baseInterval = _baseInterval;
        incrementInterval = _incrementInterval;
        maxClaim = _maxClaim;
        minTranche = _minTranche;
        maxTranche = _maxTranche;
        previousCommunity = _previousCommunity;
        communityAdmin = ICommunityAdmin(msg.sender);
        decreaseStep = _decreaseStep;
        locked = false;

        transferOwnership(msg.sender);

        // MANAGER_ROLE is the admin for the MANAGER_ROLE
        // so every manager is able to add or remove other managers
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);

        _setupRole(MANAGER_ROLE, msg.sender);
        emit ManagerAdded(msg.sender, msg.sender);

        for (uint256 i = 0; i < _managers.length; i++) {
            addManager(_managers[i]);
        }
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Enforces sender to be a valid beneficiary
     */
    modifier onlyValidBeneficiary() {
        require(
            beneficiaries[msg.sender].state == BeneficiaryState.Valid,
            "Community: NOT_VALID_BENEFICIARY"
        );
        _;
    }

    /**
     * @notice Enforces sender to have manager role
     */
    modifier onlyManagers() {
        require(hasRole(MANAGER_ROLE, msg.sender), "Community: NOT_MANAGER");
        _;
    }

    /**
     * @notice Returns the cUSD contract address
     */
    function cUSD() public view override returns (IERC20) {
        return communityAdmin.cUSD();
    }

    /**
     * @notice Returns the length of the beneficiaryList
     */
    function beneficiaryListLength() external view override returns (uint256) {
        return beneficiaryList.length();
    }

    /**
     * @notice Returns an address from the beneficiaryList
     *
     * @param index_ index value
     * @return address of the beneficiary
     */
    function beneficiaryListAt(uint256 index_) external view override returns (address) {
        return beneficiaryList.at(index_);
    }

    /**
     * @notice Returns the 0 address
     * only used for backwards compatibility
     */
    function impactMarketAddress() public pure override returns (address) {
        return address(0);
    }

    /** Updates the address of the communityAdmin
     *
     * @param _newCommunityAdmin address of the new communityAdmin
     */
    function updateCommunityAdmin(ICommunityAdmin _newCommunityAdmin) external override onlyOwner {
        address _oldCommunityAdminAddress = address(communityAdmin);
        communityAdmin = _newCommunityAdmin;

        addManager(address(communityAdmin));

        emit CommunityAdminUpdated(_oldCommunityAdminAddress, address(_newCommunityAdmin));
    }

    /** Updates the address of the previousCommunity
     *
     * @param _newPreviousCommunity address of the new previousCommunity
     */
    function updatePreviousCommunity(ICommunity _newPreviousCommunity) external override onlyOwner {
        address _oldPreviousCommunityAddress = address(previousCommunity);
        previousCommunity = _newPreviousCommunity;

        emit PreviousCommunityUpdated(_oldPreviousCommunityAddress, address(_newPreviousCommunity));
    }

    /** Updates beneficiary params
     *
     * @param _claimAmount  base amount to be claim by the beneficiary
     * @param _maxClaim limit that a beneficiary can claim  in total
     * @param _decreaseStep value decreased from maxClaim each time a is beneficiary added
     * @param _baseInterval base interval to start claiming
     * @param _incrementInterval increment interval used in each claim
     */
    function updateBeneficiaryParams(
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external override onlyOwner {
        require(
            _baseInterval > _incrementInterval,
            "Community::constructor: baseInterval must be greater than incrementInterval"
        );
        require(
            _maxClaim > _claimAmount,
            "Community::constructor: maxClaim must be greater than claimAmount"
        );

        uint256 _oldClaimAmount = claimAmount;
        uint256 _oldMaxClaim = maxClaim;
        uint256 _oldDecreaseStep = decreaseStep;
        uint256 _oldBaseInterval = baseInterval;
        uint256 _oldIncrementInterval = incrementInterval;

        claimAmount = _claimAmount;
        maxClaim = _maxClaim;
        decreaseStep = _decreaseStep;
        baseInterval = _baseInterval;
        incrementInterval = _incrementInterval;

        emit BeneficiaryParamsUpdated(
            _oldClaimAmount,
            _oldMaxClaim,
            _oldDecreaseStep,
            _oldBaseInterval,
            _oldIncrementInterval,
            _claimAmount,
            _maxClaim,
            _decreaseStep,
            _baseInterval,
            _incrementInterval
        );
    }

    /** @notice Updates params of a community
     *
     * @param _minTranche minimum amount that the community will receive when requesting funds
     * @param _maxTranche maximum amount that the community will receive when requesting funds
     */
    function updateCommunityParams(uint256 _minTranche, uint256 _maxTranche)
        external
        override
        onlyOwner
    {
        require(
            _minTranche <= _maxTranche,
            "Community::updateCommunityParams: minTranche should not be greater than maxTranche"
        );

        uint256 _oldMinTranche = minTranche;
        uint256 _oldMaxTranche = maxTranche;

        minTranche = _minTranche;
        maxTranche = _maxTranche;

        emit CommunityParamsUpdated(_oldMinTranche, _oldMaxTranche, _minTranche, _maxTranche);
    }

    /**
     * @notice Adds a new manager
     *
     * @param _account address of the manager to be added
     */
    function addManager(address _account) public override onlyManagers {
        if (!hasRole(MANAGER_ROLE, _account)) {
            super.grantRole(MANAGER_ROLE, _account);
            emit ManagerAdded(msg.sender, _account);
        }
    }

    /**
     * @notice Remove an existing manager
     *
     * @param _account address of the manager to be removed
     */
    function removeManager(address _account) external override onlyManagers {
        require(
            hasRole(MANAGER_ROLE, _account),
            "Community::removeManager: This account doesn't have manager role"
        );
        require(
            _account != address(communityAdmin),
            "Community::removeManager: You are not allow to remove communityAdmin"
        );
        super.revokeRole(MANAGER_ROLE, _account);
        emit ManagerRemoved(msg.sender, _account);
    }

    /**
     * @notice Enforces managers to use addManager method
     */
    function grantRole(bytes32, address) public pure override {
        require(false, "Community::grantRole: You are not allow to use this method");
    }

    /**
     * @notice Enforces managers to use removeManager method
     */
    function revokeRole(bytes32, address) public pure override {
        require(false, "Community::revokeRole: You are not allow to use this method");
    }

    /**
     * @notice Adds a new beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be added
     */
    function addBeneficiary(address _beneficiaryAddress)
        external
        override
        onlyManagers
        nonReentrant
    {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];
        require(
            _beneficiary.state == BeneficiaryState.NONE,
            "Community::addBeneficiary: Beneficiary exists"
        );
        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Valid);
        // solhint-disable-next-line not-rely-on-time
        _beneficiary.lastClaim = block.number;

        beneficiaryList.add(_beneficiaryAddress);

        // send default amount when adding a new beneficiary
        cUSD().safeTransfer(_beneficiaryAddress, DEFAULT_AMOUNT);

        emit BeneficiaryAdded(msg.sender, _beneficiaryAddress);
    }

    /**
     * @notice Locks a valid beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be locked
     */
    function lockBeneficiary(address _beneficiaryAddress) external override onlyManagers {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

        require(
            _beneficiary.state == BeneficiaryState.Valid,
            "Community::lockBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Locked);
        emit BeneficiaryLocked(msg.sender, _beneficiaryAddress);
    }

    /**
     * @notice  Unlocks a locked beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be unlocked
     */
    function unlockBeneficiary(address _beneficiaryAddress) external override onlyManagers {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

        require(
            _beneficiary.state == BeneficiaryState.Locked,
            "Community::unlockBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Valid);
        emit BeneficiaryUnlocked(msg.sender, _beneficiaryAddress);
    }

    /**
     * @notice Remove an existing beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be removed
     */
    function removeBeneficiary(address _beneficiaryAddress) external override onlyManagers {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

        require(
            _beneficiary.state == BeneficiaryState.Valid ||
                _beneficiary.state == BeneficiaryState.Locked,
            "Community::removeBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Removed);
        emit BeneficiaryRemoved(msg.sender, _beneficiaryAddress);
    }

    /**
     * @dev Transfers cUSD to a valid beneficiary
     */
    function claim() external override onlyValidBeneficiary nonReentrant {
        Beneficiary storage _beneficiary = beneficiaries[msg.sender];

        require(!locked, "LOCKED");
        require(claimCooldown(msg.sender) <= block.number, "Community::claim: NOT_YET");
        require(
            (_beneficiary.claimedAmount + claimAmount) <= maxClaim,
            "Community::claim: MAX_CLAIM"
        );

        _beneficiary.claimedAmount += claimAmount;
        _beneficiary.claims++;
        _beneficiary.lastClaim = block.number;

        cUSD().safeTransfer(msg.sender, claimAmount);
        emit BeneficiaryClaim(msg.sender, claimAmount);
    }

    /**
     * @notice Returns the number of blocks that a beneficiary have to wait between claims
     *
     * @param _beneficiaryAddress address of the beneficiary
     * @return uint256 number of blocks for the lastInterval
     */
    function lastInterval(address _beneficiaryAddress) public view override returns (uint256) {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];
        if (_beneficiary.claims == 0) {
            return 0;
        }
        return baseInterval + (_beneficiary.claims - 1) * incrementInterval;
    }

    /**
     * @notice Returns the block number when a beneficiary can claim again
     *
     * @param _beneficiaryAddress address of the beneficiary
     * @return uint256 number of block when the beneficiary can claim
     */
    function claimCooldown(address _beneficiaryAddress) public view override returns (uint256) {
        return beneficiaries[_beneficiaryAddress].lastClaim + lastInterval(_beneficiaryAddress);
    }

    /**
     * @notice Locks the community claims
     */
    function lock() external override onlyManagers {
        locked = true;
        emit CommunityLocked(msg.sender);
    }

    /**
     * @notice Unlocks the community claims
     */
    function unlock() external override onlyManagers {
        locked = false;
        emit CommunityUnlocked(msg.sender);
    }

    /**
     * @notice Requests treasury funds from the communityAdmin
     */
    function requestFunds() external override onlyManagers {
        communityAdmin.fundCommunity();

        lastFundRequest = block.number;

        emit FundsRequested(msg.sender);
    }

    /**
     * @notice Transfers cUSDs from donor to this community
     * Used by donationToCommunity method from DonationMiner contract
     *
     * @param _sender address of the sender
     * @param _amount amount to be donated
     */
    function donate(address _sender, uint256 _amount) external override nonReentrant {
        cUSD().safeTransferFrom(_sender, address(this), _amount);
        privateFunds += _amount;

        emit Donate(msg.sender, _amount);
    }

    /**
     * @notice Increases the treasuryFunds value
     * Used by communityAdmin after an amount of cUSD are sent from the treasury
     *
     * @param _amount amount to be added to treasuryFunds
     */
    function addTreasuryFunds(uint256 _amount) external override onlyOwner {
        treasuryFunds += _amount;
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param _token address of the ERC20 token
     * @param _to address of the receiver
     * @param _amount amount of the transaction
     */
    function transfer(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner nonReentrant {
        _token.safeTransfer(_to, _amount);

        emit TransferERC20(address(_token), _to, _amount);
    }

    /**
     * @notice Allows a beneficiary from the previousCommunity to join in this community
     */
    function beneficiaryJoinFromMigrated() external override {
        // no need to check if it's a beneficiary, as the state is copied
        Beneficiary storage _beneficiary = beneficiaries[msg.sender];

        require(
            _beneficiary.state == BeneficiaryState.NONE,
            "Community::beneficiaryJoinFromMigrated: Beneficiary exists"
        );

        //if the previousCommunity is deployed with the new type of smart contract
        if (previousCommunity.impactMarketAddress() == address(0)) {
            (
                BeneficiaryState _oldBeneficiaryState,
                uint256 _oldBeneficiaryClaims,
                uint256 _oldBeneficiaryClaimedAmount,
                uint256 _oldBeneficiaryLastClaim
            ) = previousCommunity.beneficiaries(msg.sender);

            _changeBeneficiaryState(_beneficiary, _oldBeneficiaryState);
            _beneficiary.claims = _oldBeneficiaryClaims;
            _beneficiary.lastClaim = _oldBeneficiaryLastClaim;
            _beneficiary.claimedAmount = _oldBeneficiaryClaimedAmount;
        } else {
            ICommunityOld _oldCommunity = ICommunityOld(address(previousCommunity));
            uint256 _oldBeneficiaryLastInterval = _oldCommunity.lastInterval(msg.sender);
            _changeBeneficiaryState(
                _beneficiary,
                BeneficiaryState(_oldCommunity.beneficiaries(msg.sender))
            );

            uint256 _oldBeneficiaryCooldown = _oldCommunity.cooldown(msg.sender);

            if (_oldBeneficiaryCooldown >= _oldBeneficiaryLastInterval + _firstBlockTimestamp()) {
                // seconds to blocks conversion
                _beneficiary.lastClaim =
                    (_oldBeneficiaryCooldown -
                        _oldBeneficiaryLastInterval -
                        _firstBlockTimestamp()) /
                    5;
            } else {
                _beneficiary.lastClaim = 0;
            }

            _beneficiary.claimedAmount = _oldCommunity.claimed(msg.sender);

            uint256 _previousBaseInterval = _oldCommunity.baseInterval();
            if (_oldBeneficiaryLastInterval >= _previousBaseInterval) {
                _beneficiary.claims =
                    (_oldBeneficiaryLastInterval - _previousBaseInterval) /
                    _oldCommunity.incrementInterval() +
                    1;
            } else {
                _beneficiary.claims = 0;
            }
        }

        beneficiaryList.add(msg.sender);

        emit BeneficiaryJoined(msg.sender);
    }

    /**
     * @notice Returns the initial maxClaim
     */
    function getInitialMaxClaim() external view override returns (uint256) {
        return maxClaim + validBeneficiaryCount * decreaseStep;
    }

    /**
     * @notice Changes the state of a beneficiary
     *
     * @param _beneficiary address of the beneficiary
     * @param _newState new state
     */
    function _changeBeneficiaryState(Beneficiary storage _beneficiary, BeneficiaryState _newState)
        internal
    {
        if (_beneficiary.state == _newState) {
            return;
        }

        if (_newState == BeneficiaryState.Valid) {
            require(
                maxClaim - decreaseStep >= claimAmount,
                "Community::_changeBeneficiaryState: Max claim too low"
            );
            validBeneficiaryCount++;
            maxClaim -= decreaseStep;
        } else if (_beneficiary.state == BeneficiaryState.Valid) {
            validBeneficiaryCount--;
            maxClaim += decreaseStep;
        }

        _beneficiary.state = _newState;
    }

    function _firstBlockTimestamp() public view returns (uint256) {
        if (block.chainid == 42220) {
            //celo mainnet
            return 1587571205;
        } else if (block.chainid == 44787) {
            //alfajores testnet
            return 1594921556;
        } else if (block.chainid == 44787) {
            //baklava testnet
            return 1593012289;
        } else {
            return block.timestamp - block.number; //local
        }
    }
}
