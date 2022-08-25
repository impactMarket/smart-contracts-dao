// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityLegacy.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./interfaces/CommunityStorageV2.sol";

/**
 * @notice Welcome to the Community contract. For each community
 * there will be one proxy contract deployed by CommunityAdmin.
 * The implementation of the proxy is this contract. This enable
 * us to save tokens on the contract itself, and avoid the problems
 * of having everything in one single contract.
 *Each community has it's own members and and managers.
 */
contract CommunityImplementation is
    Initializable,
    AccessControlUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    CommunityStorageV2
{
    using SafeERC20 for IERC20;
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
     * @notice Triggered when someone has donated token
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
     * @notice Triggered when maxBeneficiaries has been updated
     *
     * @param oldMaxBeneficiaries   Old maxBeneficiaries value
     * @param newMaxBeneficiaries   New maxBeneficiaries value
     */
    event MaxBeneficiariesUpdated(
        uint256 indexed oldMaxBeneficiaries,
        uint256 indexed newMaxBeneficiaries
    );

    /**
     * @notice Triggered when token address has been updated
     *
     * @param oldTokenAddress   Old token address
     * @param newTokenAddress   New token address
     */
    event TokenUpdated(address indexed oldTokenAddress, address indexed newTokenAddress);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

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
     * @notice Enforces sender to be the community ambassador or entity ambassador responsible
     */
    modifier onlyAmbassadorOrEntity() {
        require(
            communityAdmin.isAmbassadorOrEntityOfCommunity(address(this), msg.sender),
            "Community: NOT_AMBASSADOR_OR_ENTITY"
        );
        _;
    }

    /**
     * @notice Enforces sender to be the owner or community ambassador or entity ambassador responsible
     */
    modifier onlyOwnerOrAmbassadorOrEntity() {
        require(
            msg.sender == owner() ||
                communityAdmin.isAmbassadorOrEntityOfCommunity(address(this), msg.sender),
            "Community: NOT_OWNER_OR_AMBASSADOR_OR_ENTITY"
        );
        _;
    }

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
     * @param _minTranche          Minimum amount that the community will receive when requesting funds
     * @param _maxTranche          Maximum amount that the community will receive when requesting funds
     * @param _maxBeneficiaries    Maximum valid beneficiaries number
     * @param _previousCommunity   Previous smart contract address of community
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
        uint256 _maxBeneficiaries,
        ICommunity _previousCommunity
    ) external override initializer {
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
        maxBeneficiaries = _maxBeneficiaries;
        locked = false;

        transferOwnership(msg.sender);

        // MANAGER_ROLE is the admin for the MANAGER_ROLE
        // so every manager is able to add or remove other managers
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);

        _setupRole(MANAGER_ROLE, msg.sender);
        emit ManagerAdded(msg.sender, msg.sender);

        uint256 _i;
        uint256 _numberOfManagers = _managers.length;
        for (; _i < _numberOfManagers; _i++) {
            addManager(_managers[_i]);
        }
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 2;
    }

    /**
     * @notice Returns the cUSD contract address
     * todo: to be removed, use token() instead
     */
    function cUSD() public view override returns (IERC20) {
        return address(_token) != address(0) ? _token : communityAdmin.cUSD();
    }

    /**
     * @notice Returns the address of the token used by this community
     */
    function token() public view override returns (IERC20) {
        return address(_token) != address(0) ? _token : communityAdmin.cUSD();
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
        emit CommunityAdminUpdated(address(communityAdmin), address(_newCommunityAdmin));
        communityAdmin = _newCommunityAdmin;

        addManager(address(communityAdmin));
    }

    /** Updates the address of the previousCommunity
     *
     * @param _newPreviousCommunity address of the new previousCommunity
     */
    function updatePreviousCommunity(ICommunity _newPreviousCommunity) external override onlyOwner {
        emit PreviousCommunityUpdated(address(previousCommunity), address(_newPreviousCommunity));
        previousCommunity = _newPreviousCommunity;
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
            _maxClaim > _claimAmount + validBeneficiaryCount * _decreaseStep,
            "Community::constructor: maxClaim must be greater than claimAmount"
        );

        emit BeneficiaryParamsUpdated(
            claimAmount,
            maxClaim,
            decreaseStep,
            baseInterval,
            incrementInterval,
            _claimAmount,
            _maxClaim,
            _decreaseStep,
            _baseInterval,
            _incrementInterval
        );

        claimAmount = _claimAmount;
        maxClaim = _maxClaim - validBeneficiaryCount * _decreaseStep;
        decreaseStep = _decreaseStep;
        baseInterval = _baseInterval;
        incrementInterval = _incrementInterval;
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

        emit CommunityParamsUpdated(minTranche, maxTranche, _minTranche, _maxTranche);

        minTranche = _minTranche;
        maxTranche = _maxTranche;
    }

    /** @notice Updates maxBeneficiaries
     *
     * @param _newMaxBeneficiaries new _maxBeneficiaries value
     */
    function updateMaxBeneficiaries(uint256 _newMaxBeneficiaries)
        external
        override
        onlyOwnerOrAmbassadorOrEntity
    {
        emit MaxBeneficiariesUpdated(maxBeneficiaries, _newMaxBeneficiaries);
        maxBeneficiaries = _newMaxBeneficiaries;
    }

    /** @notice Updates token address
     *
     * @param _newToken       new token address
     * @param _exchangePath   path used by uniswap to exchange the current tokens to the new tokens
     */
    function updateToken(IERC20 _newToken, address[] memory _exchangePath)
        external
        override
        onlyOwner
    {
        require(
            _newToken == communityAdmin.cUSD() ||
                communityAdmin.treasury().isToken(address(_newToken)),
            "Community::updateToken: Invalid token"
        );

        require(
            _exchangePath.length > 1 &&
                _exchangePath[0] == address(token()) &&
                _exchangePath[_exchangePath.length - 1] == address(_newToken),
            "Community::updateToken: invalid exchangePath"
        );

        uint256 _balance = token().balanceOf(address(this));
        token().approve(address(communityAdmin.treasury().uniswapRouter()), _balance);
        communityAdmin
            .treasury()
            .uniswapRouter()
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                _balance,
                0,
                _exchangePath,
                address(this),
                block.timestamp + 3600
            );

        emit TokenUpdated(address(_token), address(_newToken));
        _token = _newToken;
    }

    /**
     * @notice Adds a new manager
     *
     * @param _account address of the manager to be added
     */
    function addManager(address _account) public override onlyAmbassadorOrEntity {
        if (!hasRole(MANAGER_ROLE, _account)) {
            super._grantRole(MANAGER_ROLE, _account);
            emit ManagerAdded(msg.sender, _account);
        }
    }

    /**
     * @notice Remove an existing manager
     *
     * @param _account address of the manager to be removed
     */
    function removeManager(address _account) external override onlyAmbassadorOrEntity {
        require(
            hasRole(MANAGER_ROLE, _account),
            "Community::removeManager: This account doesn't have manager role"
        );
        require(
            _account != address(communityAdmin),
            "Community::removeManager: You are not allow to remove communityAdmin"
        );
        super._revokeRole(MANAGER_ROLE, _account);
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
     * @notice Adds new beneficiaries
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be added
     */
    function addBeneficiaries(address[] memory _beneficiaryAddresses)
        external
        override
        onlyManagers
        nonReentrant
    {
        require(!locked, "LOCKED");

        uint256 _index;
        uint256 _numberOfBeneficiaries = _beneficiaryAddresses.length;
        for (; _index < _numberOfBeneficiaries; _index++) {
            _addBeneficiary(_beneficiaryAddresses[_index]);
        }
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
        require(!locked, "LOCKED");

        _addBeneficiary(_beneficiaryAddress);
    }

    /**
     * @notice Locks a valid beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be locked
     */
    function lockBeneficiary(address _beneficiaryAddress) external override onlyManagers {
        require(!locked, "LOCKED");

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
        require(!locked, "LOCKED");

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
     * @dev Transfers tokens to a valid beneficiary
     */
    function claim() external override onlyValidBeneficiary nonReentrant {
        Beneficiary storage _beneficiary = beneficiaries[msg.sender];

        require(!locked, "LOCKED");
        require(claimCooldown(msg.sender) <= block.number, "Community::claim: NOT_YET");
        require(
            _beneficiary.claimedAmount < maxClaim,
            "Community::claim: Already claimed everything"
        );

        uint256 _toClaim = claimAmount <= maxClaim - _beneficiary.claimedAmount
            ? claimAmount
            : maxClaim - _beneficiary.claimedAmount;

        _beneficiary.claimedAmount += _toClaim;
        _beneficiary.claims++;
        _beneficiary.lastClaim = block.number;

        token().safeTransfer(msg.sender, _toClaim);
        emit BeneficiaryClaim(msg.sender, _toClaim);
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
     * @notice Locks the community
     */
    function lock() external override onlyAmbassadorOrEntity {
        locked = true;
        emit CommunityLocked(msg.sender);
    }

    /**
     * @notice Unlocks the community
     */
    function unlock() external override onlyAmbassadorOrEntity {
        locked = false;
        emit CommunityUnlocked(msg.sender);
    }

    /**
     * @notice Requests treasury funds from the communityAdmin
     */
    function requestFunds() external override onlyManagers {
        require(!locked, "LOCKED");

        communityAdmin.fundCommunity();

        lastFundRequest = block.number;

        emit FundsRequested(msg.sender);
    }

    /**
     * @notice Transfers tokens from donor to this community
     * Used by donationToCommunity method from DonationMiner contract
     *
     * @param _sender address of the sender
     * @param _amount amount to be donated
     */
    function donate(address _sender, uint256 _amount) external override nonReentrant {
        token().safeTransferFrom(_sender, address(this), _amount);
        privateFunds += _amount;

        emit Donate(msg.sender, _amount);
    }

    /**
     * @notice Increases the treasuryFunds value
     * Used by communityAdmin after an amount of tokens are sent from the treasury
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
    function beneficiaryJoinFromMigrated(address _beneficiaryAddress) external override {
        // no need to check if it's a beneficiary, as the state is copied
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

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
            ) = previousCommunity.beneficiaries(_beneficiaryAddress);

            _changeBeneficiaryState(_beneficiary, _oldBeneficiaryState);
            _beneficiary.claims = _oldBeneficiaryClaims;
            _beneficiary.lastClaim = _oldBeneficiaryLastClaim;
            _beneficiary.claimedAmount = _oldBeneficiaryClaimedAmount;
        } else {
            ICommunityLegacy _legacyCommunity = ICommunityLegacy(address(previousCommunity));
            uint256 _legacyBeneficiaryLastInterval = _legacyCommunity.lastInterval(
                _beneficiaryAddress
            );
            _changeBeneficiaryState(
                _beneficiary,
                BeneficiaryState(_legacyCommunity.beneficiaries(_beneficiaryAddress))
            );

            uint256 _legacyBeneficiaryCooldown = _legacyCommunity.cooldown(_beneficiaryAddress);

            if (
                _legacyBeneficiaryCooldown >=
                _legacyBeneficiaryLastInterval + _firstBlockTimestamp()
            ) {
                // seconds to blocks conversion
                _beneficiary.lastClaim =
                    (_legacyBeneficiaryCooldown -
                        _legacyBeneficiaryLastInterval -
                        _firstBlockTimestamp()) /
                    5;
            } else {
                _beneficiary.lastClaim = 0;
            }

            _beneficiary.claimedAmount = _legacyCommunity.claimed(_beneficiaryAddress);

            uint256 _previousBaseInterval = _legacyCommunity.baseInterval();
            if (_legacyBeneficiaryLastInterval >= _previousBaseInterval) {
                _beneficiary.claims =
                    (_legacyBeneficiaryLastInterval - _previousBaseInterval) /
                    _legacyCommunity.incrementInterval() +
                    1;
            } else {
                _beneficiary.claims = 0;
            }
        }

        beneficiaryList.add(_beneficiaryAddress);

        emit BeneficiaryJoined(_beneficiaryAddress);
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
            require(
                maxBeneficiaries == 0 || validBeneficiaryCount < maxBeneficiaries,
                "Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
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

    /**
     * @notice Adds a new beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be added
     */
    function _addBeneficiary(address _beneficiaryAddress) internal {
        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

        if (_beneficiary.state != BeneficiaryState.NONE) {
            return;
        }

        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Valid);
        _beneficiary.lastClaim = block.number;

        beneficiaryList.add(_beneficiaryAddress);

        // send default amount when adding a new beneficiary
        token().safeTransfer(_beneficiaryAddress, DEFAULT_AMOUNT);

        emit BeneficiaryAdded(msg.sender, _beneficiaryAddress);
    }
}
