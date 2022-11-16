// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./interfaces/CommunityStorageV3.sol";

import "hardhat/console.sol";

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
    CommunityStorageV3
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using ECDSA for bytes32;

    bytes32 private constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 private constant DEFAULT_AMOUNT = 5e16;
    uint256 private constant MAX_TOKEN_LIST_LENGTH = 10;

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
     * @param oldOriginalClaimAmount    Old originalClaimAmount value
     * @param oldMaxTotalClaim          Old maxTotalClaim value
     * @param oldDecreaseStep           Old decreaseStep value
     * @param oldBaseInterval           Old baseInterval value
     * @param oldIncrementInterval      Old incrementInterval value
     * @param newOriginalClaimAmount    New originalClaimAmount value
     * @param newMaxTotalClaim          New maxTotalClaim value
     * @param newDecreaseStep           New decreaseStep value
     * @param newBaseInterval           New baseInterval value
     * @param newIncrementInterval      New incrementInterval value
     *
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    event BeneficiaryParamsUpdated(
        uint256 oldOriginalClaimAmount,
        uint256 oldMaxTotalClaim,
        uint256 oldDecreaseStep,
        uint256 oldBaseInterval,
        uint256 oldIncrementInterval,
        uint256 newOriginalClaimAmount,
        uint256 newMaxTotalClaim,
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
    event MaxBeneficiariesUpdated(uint256 oldMaxBeneficiaries, uint256 newMaxBeneficiaries);

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
     * @notice Triggered when claimAmount has been changed
     *
     * @param oldClaimAmount   Old claimAmount value
     * @param newClaimAmount   New claimAmount value
     */
    event ClaimAmountUpdated(uint256 oldClaimAmount, uint256 newClaimAmount);

    /**
     * @notice Enforces sender to be a valid beneficiary
     */
    modifier onlyValidBeneficiary() {
        require(
            _beneficiaries[msg.sender].state == BeneficiaryState.Valid,
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
     * @dev Modifier to make a function callable only when the contract is not locked
     *
     * Requirements:
     *
     * - The contract must not be locked.
     */
    modifier whenNotLocked() {
        require(!locked, "Community: locked");
        _;
    }

    /**
     * @notice Used to initialize a new Community contract
     *
     * @param _tokenAddress        Address of the token used by the community
     * @param _managers            Community's initial managers
     *                             Will be able to add others
     * @param _originalClaimAmount      Maximum base amount to be claim by the beneficiary
     * @param _maxTotalClaim       Limit that a beneficiary can claim in total
     * @param _decreaseStep        Value decreased from maxTotalClaim each time a beneficiary is added
     * @param _baseInterval        Base interval to start claiming
     * @param _incrementInterval   Increment interval used in each claim
     * @param _minTranche          Minimum amount that the community will receive when requesting funds
     * @param _maxTranche          Maximum amount that the community will receive when requesting funds
     * @param _maxBeneficiaries    Maximum valid beneficiaries number
     * @param _previousCommunity   Previous smart contract address of community
     */
    function initialize(
        address _tokenAddress,
        address[] memory _managers,
        uint256 _originalClaimAmount,
        uint256 _maxTotalClaim,
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
            _maxTotalClaim >= _originalClaimAmount,
            "Community::initialize: originalClaimAmount to big"
        );

        require(
            _minTranche <= _maxTranche,
            "Community::initialize: minTranche should not be greater than maxTranche"
        );

        communityAdmin = ICommunityAdmin(msg.sender);

        __AccessControl_init();
        __Ownable_init();
        __ReentrancyGuard_init();

        _token = IERC20(_tokenAddress);
        originalClaimAmount = _originalClaimAmount;
        claimAmount = _originalClaimAmount;
        baseInterval = _baseInterval;
        incrementInterval = _incrementInterval;
        maxTotalClaim = _maxTotalClaim;
        minTranche = _minTranche;
        maxTranche = _maxTranche;
        previousCommunity = _previousCommunity;
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
            _addManager(_managers[_i]);
        }
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 3;
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

    /**
     * @notice Returns the data of a beneficiary
     *
     * @param _beneficiaryAddress    address of the beneficiary
     * @return state                 the status of the beneficiary
     * @return claims                how many times the beneficiary has claimed
     * @return claimedAmount         the amount he has claimed
     * @return lastClaim             block number of the last claim
     */
    function beneficiaries(address _beneficiaryAddress)
        external
        view
        override
        returns (
            BeneficiaryState state,
            uint256 claims,
            uint256 claimedAmount,
            uint256 lastClaim
        )
    {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        return (
            _beneficiary.state,
            _beneficiary.claims,
            _beneficiaryClaimedAmount(_beneficiary),
            _beneficiary.lastClaim
        );
    }

    /**
     * @notice Returns the beneficiary's claimed amounts for each token
     *
     * @param _beneficiaryAddress    address of the beneficiary
     * @return claimedAmounts        a uint256 array with all claimed amounts in the same order as tokenList array
     */
    function beneficiaryClaimedAmounts(address _beneficiaryAddress)
        external
        view
        override
        returns (uint256[] memory claimedAmounts)
    {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        uint256[] memory _claimedAmounts = new uint256[](_tokenList.length());
        uint256 _length = _tokenList.length();

        for (uint256 _index = 0; _index < _length; _index++) {
            _claimedAmounts[_index] = _beneficiary.claimedAmounts[_tokenList.at(_index)];
        }

        if (_claimedAmounts.length == 0) {
            _claimedAmounts = new uint256[](1);
            _claimedAmounts[0] = _beneficiary.claimedAmount;
        }

        return _claimedAmounts;
    }

    /**
     * @notice Returns the length of the tokenList
     */
    function tokensLength() external view override returns (uint256) {
        return tokens.length;
    }

    function tokenList() public view override returns (address[] memory) {
        address[] memory _tokenListArray = new address[](_tokenList.length());
        uint256 _length = _tokenList.length();

        for (uint256 _index = 0; _index < _length; _index++) {
            _tokenListArray[_index] = _tokenList.at(_index);
        }

        if (_tokenListArray.length == 0) {
            _tokenListArray = new address[](1);
            _tokenListArray[0] = address(token());
        }

        return _tokenListArray;
    }

    /**
     * @notice Returns the amount that can be claimed by a beneficiary in total
     * todo: remove it after the frontend is updated to the new function: maxTotalClaim()
     */
    function maxClaim() external view override returns (uint256) {
        return maxTotalClaim;
    }

    function isSelfFunding() public view override returns (bool) {
        return maxTranche == 0;
    }

    /** Updates the address of the communityAdmin
     *
     * @param _newCommunityAdmin address of the new communityAdmin
     */
    function updateCommunityAdmin(ICommunityAdmin _newCommunityAdmin) external override onlyOwner {
        emit CommunityAdminUpdated(address(communityAdmin), address(_newCommunityAdmin));
        communityAdmin = _newCommunityAdmin;

        _addManager(address(communityAdmin));
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
     * @param _originalClaimAmount maximum base amount to be claim by the beneficiary
     * @param _maxTotalClaim limit that a beneficiary can claim  in total
     * @param _decreaseStep value decreased from maxTotalClaim each time a is beneficiary added
     * @param _baseInterval base interval to start claiming
     * @param _incrementInterval increment interval used in each claim
     *
     * @notice be aware that max claim will not be the same with the value you've provided
     *             maxTotalClaim = _maxTotalClaim - validBeneficiaryCount * _decreaseStep
     */
    function updateBeneficiaryParams(
        uint256 _originalClaimAmount,
        uint256 _maxTotalClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) public override onlyOwner {
        require(
            _baseInterval > _incrementInterval,
            "Community::updateBeneficiaryParams: baseInterval must be greater than incrementInterval"
        );
        require(
            _maxTotalClaim >= _originalClaimAmount + validBeneficiaryCount * _decreaseStep,
            "Community::updateBeneficiaryParams: originalClaimAmount too big"
        );

        emit BeneficiaryParamsUpdated(
            originalClaimAmount,
            maxTotalClaim,
            decreaseStep,
            baseInterval,
            incrementInterval,
            _originalClaimAmount,
            _maxTotalClaim,
            _decreaseStep,
            _baseInterval,
            _incrementInterval
        );

        originalClaimAmount = _originalClaimAmount;
        maxTotalClaim = _maxTotalClaim - validBeneficiaryCount * _decreaseStep;
        decreaseStep = _decreaseStep;
        baseInterval = _baseInterval;
        incrementInterval = _incrementInterval;

        _updateClaimAmount();
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
     *   !!!!!! you must be careful about _maxTotalClaim value. This value determines all beneficiaries claimedAmounts
     */
    function updateToken(
        IERC20 _newToken,
        address[] calldata _exchangePath,
        uint256 _originalClaimAmount,
        uint256 _maxTotalClaim,
        uint256 _decreaseStep,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external override onlyOwner {
        ITreasury _treasury = communityAdmin.treasury();

        require(
            tokens.length < MAX_TOKEN_LIST_LENGTH,
            "Community::updateToken: Token list length too big"
        );

        require(
            _newToken != token(),
            "Community::updateToken: New token cannot be the same as the current token"
        );

        require(
            _newToken == communityAdmin.cUSD() || _treasury.isToken(address(_newToken)),
            "Community::updateToken: Invalid token"
        );

        require(
            _exchangePath.length > 1 &&
                _exchangePath[0] == address(token()) &&
                _exchangePath[_exchangePath.length - 1] == address(_newToken),
            "Community::updateToken: invalid exchangePath"
        );

        //for communities already deployed, we need to add the current token before changing
        if (tokens.length == 0) {
            tokens.push(Token(address(token()), 1e18, 0));
            _tokenList.add(address(token()));
        }

        uint256 _conversionRatio = (1e18 * _maxTotalClaim) / getInitialMaxTotalClaim();

        tokens.push(Token(address(_newToken), _conversionRatio, block.number));
        _tokenList.add(address(_newToken));

        IUniswapV2Router _uniswap = _treasury.uniswapRouter();

        uint256 _balance = token().balanceOf(address(this));
        token().approve(address(_uniswap), _balance);
        _uniswap.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            _balance,
            0,
            _exchangePath,
            address(this),
            block.timestamp + 3600
        );

        emit TokenUpdated(address(_token), address(_newToken));
        _token = _newToken;

        updateBeneficiaryParams(
            _originalClaimAmount,
            _maxTotalClaim,
            _decreaseStep,
            _baseInterval,
            _incrementInterval
        );
    }

    /**
     * @notice Adds a new manager
     *
     * @param _account address of the manager to be added
     */
    function addManager(address _account) public override onlyAmbassadorOrEntity {
        _addManager(_account);
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
     * @notice Adds a new beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be added
     */
    function addBeneficiary(address _beneficiaryAddress)
        external
        override
        whenNotLocked
        onlyManagers
        nonReentrant
    {
        _addBeneficiary(_beneficiaryAddress);

        emit BeneficiaryAdded(msg.sender, _beneficiaryAddress);
    }

    /**
     * @notice Adds new beneficiaries
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be added
     */
    function addBeneficiaries(address[] memory _beneficiaryAddresses)
        external
        override
        whenNotLocked
        onlyManagers
        nonReentrant
    {
        _addBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Adds new beneficiaries using a manager signature
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be added
     * @param _expirationTimestamp  timestamp when the signature will expire/expired
     * @param _signature            the signature of a manager
     */
    function addBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external override whenNotLocked nonReentrant {
        _checkManagerSignature(_expirationTimestamp, _signature);

        _addBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Locks a valid beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be locked
     */
    function lockBeneficiary(address _beneficiaryAddress)
        external
        override
        whenNotLocked
        onlyManagers
    {
        _lockBeneficiary(_beneficiaryAddress);
    }

    /**
     * @notice Locks a list of beneficiaries
     *
     * @param _beneficiaryAddresses       addresses of the beneficiaries to be locked
     */
    function lockBeneficiaries(address[] memory _beneficiaryAddresses)
        external
        override
        whenNotLocked
        onlyManagers
    {
        _lockBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Locks a list of beneficiaries using a manager signature
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be locked
     * @param _expirationTimestamp  timestamp when the signature will expire/expired
     * @param _signature            the signature of a manager
     */
    function lockBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external override whenNotLocked {
        _checkManagerSignature(_expirationTimestamp, _signature);
        _lockBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice  Unlocks a locked beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be unlocked
     */
    function unlockBeneficiary(address _beneficiaryAddress)
        external
        override
        whenNotLocked
        onlyManagers
    {
        _unlockBeneficiary(_beneficiaryAddress);
    }

    /**
     * @notice Unlocks a list of beneficiaries
     *
     * @param _beneficiaryAddresses       addresses of the beneficiaries to be unlocked
     */
    function unlockBeneficiaries(address[] memory _beneficiaryAddresses)
        external
        override
        whenNotLocked
        onlyManagers
    {
        _unlockBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Unlocks a list of beneficiaries using a manager signature
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be unlocked
     * @param _expirationTimestamp  timestamp when the signature will expire/expired
     * @param _signature            the signature of a manager
     */
    function unlockBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external override whenNotLocked {
        _checkManagerSignature(_expirationTimestamp, _signature);
        _unlockBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Remove an existing beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be removed
     */
    function removeBeneficiary(address _beneficiaryAddress) external override onlyManagers {
        _removeBeneficiary(_beneficiaryAddress);
    }

    /**
     * @notice Removes a list of beneficiaries
     *
     * @param _beneficiaryAddresses       addresses of the beneficiaries to be removed
     */
    function removeBeneficiaries(address[] memory _beneficiaryAddresses)
        external
        override
        onlyManagers
    {
        _removeBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @notice Removes a list of beneficiaries using a manager signature
     *
     * @param _beneficiaryAddresses addresses of the beneficiaries to be removed
     * @param _expirationTimestamp  timestamp when the signature will expire/expired
     * @param _signature            the signature of a manager
     */
    function removeBeneficiariesUsingSignature(
        address[] memory _beneficiaryAddresses,
        uint256 _expirationTimestamp,
        bytes calldata _signature
    ) external override {
        _checkManagerSignature(_expirationTimestamp, _signature);
        _removeBeneficiaries(_beneficiaryAddresses);
    }

    /**
     * @dev Transfers tokens to a valid beneficiary
     */
    function claim() external override whenNotLocked onlyValidBeneficiary nonReentrant {
        Beneficiary storage _beneficiary = _beneficiaries[msg.sender];

        uint256 _totalClaimedAmount = _beneficiaryClaimedAmount(_beneficiary);

        require(claimCooldown(msg.sender) <= block.number, "Community::claim: NOT_YET");
        require(
            _totalClaimedAmount < maxTotalClaim,
            "Community::claim: Already claimed everything"
        );

        uint256 _claimAmount = claimAmount > 0 ? claimAmount : originalClaimAmount;

        uint256 _toClaim = _claimAmount <= maxTotalClaim - _totalClaimedAmount
            ? _claimAmount
            : maxTotalClaim - _totalClaimedAmount;

        //this is necessary for communities with version < 3
        //and for beneficiaries that haven't claimed after updating to v3
        if (tokens.length > 1 && _beneficiary.lastClaim < tokens[1].startBlock) {
            _beneficiary.claimedAmounts[tokens[0].tokenAddress] = _beneficiary.claimedAmount;
        }

        _beneficiary.claimedAmount = _totalClaimedAmount + _toClaim;
        _beneficiary.claims++;
        _beneficiary.lastClaim = block.number;

        if (tokens.length > 1) {
            _beneficiary.claimedAmounts[address(token())] += _toClaim;
        }

        IERC20Upgradeable(address(token())).safeTransfer(msg.sender, _toClaim);
        emit BeneficiaryClaim(msg.sender, _toClaim);
    }

    /**
     * @notice Returns the number of blocks that a beneficiary have to wait between claims
     *
     * @param _beneficiaryAddress address of the beneficiary
     * @return uint256 number of blocks for the lastInterval
     */
    function lastInterval(address _beneficiaryAddress) public view override returns (uint256) {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];
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
        return _beneficiaries[_beneficiaryAddress].lastClaim + lastInterval(_beneficiaryAddress);
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
    function requestFunds() external override whenNotLocked onlyManagers {
        require(!isSelfFunding(), "Community::requestFunds: This community is self-funding");

        communityAdmin.fundCommunity();

        lastFundRequest = block.number;

        _updateClaimAmount();

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
        IERC20Upgradeable(address(token())).safeTransferFrom(_sender, address(this), _amount);
        privateFunds += _amount;

        _updateClaimAmount();

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
        IERC20Upgradeable(address(_token)).safeTransfer(_to, _amount);

        if (address(_token) == address(token())) {
            _updateClaimAmount();
        }

        emit TransferERC20(address(_token), _to, _amount);
    }

    /**
     * @notice Allows a beneficiary from the previousCommunity to join in this community
     */
    function beneficiaryJoinFromMigrated(address _beneficiaryAddress) external override {
        // no need to check if it's a beneficiary, as the state is copied
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        require(
            _beneficiary.state == BeneficiaryState.NONE,
            "Community::beneficiaryJoinFromMigrated: Beneficiary exists"
        );

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

        beneficiaryList.add(_beneficiaryAddress);

        emit BeneficiaryJoined(_beneficiaryAddress);
    }

    /**
     * @notice Returns the initial maxTotalClaim
     * todo: do be deleted after updating all communities to v3
     */
    function getInitialMaxClaim() public view override returns (uint256) {
        return maxTotalClaim + validBeneficiaryCount * decreaseStep;
    }

    /**
     * @notice Returns the initial maxTotalClaim
     */
    function getInitialMaxTotalClaim() public view returns (uint256) {
        return maxTotalClaim + validBeneficiaryCount * decreaseStep;
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
                maxTotalClaim - decreaseStep >= originalClaimAmount,
                "Community::_changeBeneficiaryState: Max claim too low"
            );
            require(
                maxBeneficiaries == 0 || validBeneficiaryCount < maxBeneficiaries,
                "Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
            );
            validBeneficiaryCount++;
            maxTotalClaim -= decreaseStep;
        } else if (_beneficiary.state == BeneficiaryState.Valid) {
            validBeneficiaryCount--;
            maxTotalClaim += decreaseStep;
        }

        _beneficiary.state = _newState;
    }

    /**
     * @notice Adds a new beneficiary
     *
     * @param _beneficiaryAddress address of the beneficiary to be added
     */
    function _addBeneficiary(address _beneficiaryAddress) internal {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        if (_beneficiary.state != BeneficiaryState.NONE) {
            return;
        }

        _changeBeneficiaryState(_beneficiary, BeneficiaryState.Valid);
        _beneficiary.lastClaim = block.number;

        beneficiaryList.add(_beneficiaryAddress);

        // send default amount when adding a new beneficiary
        IERC20Upgradeable(address(token())).safeTransfer(_beneficiaryAddress, DEFAULT_AMOUNT);
    }

    /**
     * @notice Adds new beneficiaries
     *
     * @param _beneficiaryAddresses addresses of beneficiaries to be added
     */
    function _addBeneficiaries(address[] memory _beneficiaryAddresses) internal {
        uint256 _index;
        uint256 _numberOfBeneficiaries = _beneficiaryAddresses.length;
        for (; _index < _numberOfBeneficiaries; _index++) {
            _addBeneficiary(_beneficiaryAddresses[_index]);
            emit BeneficiaryAdded(msg.sender, _beneficiaryAddresses[_index]);
        }
    }

    /**
     * @notice Locks beneficiary
     *
     * @param _beneficiaryAddress address of beneficiary to be locked
     */
    function _lockBeneficiary(address _beneficiaryAddress) internal {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        if (_beneficiary.state == BeneficiaryState.Valid) {
            _changeBeneficiaryState(_beneficiary, BeneficiaryState.Locked);
            emit BeneficiaryLocked(msg.sender, _beneficiaryAddress);
        }
    }

    /**
     * @notice Locks beneficiaries
     *
     * @param _beneficiaryAddresses addresses of beneficiaries to be locked
     */
    function _lockBeneficiaries(address[] memory _beneficiaryAddresses) internal {
        uint256 _index;
        uint256 _numberOfBeneficiaries = _beneficiaryAddresses.length;

        for (; _index < _numberOfBeneficiaries; _index++) {
            _lockBeneficiary(_beneficiaryAddresses[_index]);
        }
    }

    /**
     * @notice Unlocks beneficiary
     *
     * @param _beneficiaryAddress address of beneficiary to be unlocked
     */
    function _unlockBeneficiary(address _beneficiaryAddress) internal {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        if (_beneficiary.state == BeneficiaryState.Locked) {
            _changeBeneficiaryState(_beneficiary, BeneficiaryState.Valid);
            emit BeneficiaryUnlocked(msg.sender, _beneficiaryAddress);
        }
    }

    /**
     * @notice Unlocks beneficiaries
     *
     * @param _beneficiaryAddresses addresses of beneficiaries to be unlocked
     */
    function _unlockBeneficiaries(address[] memory _beneficiaryAddresses) internal {
        uint256 _index;
        uint256 _numberOfBeneficiaries = _beneficiaryAddresses.length;

        for (; _index < _numberOfBeneficiaries; _index++) {
            _unlockBeneficiary(_beneficiaryAddresses[_index]);
        }
    }

    /**
     * @notice Removes beneficiary
     *
     * @param _beneficiaryAddress address of beneficiary to be removed
     */
    function _removeBeneficiary(address _beneficiaryAddress) internal {
        Beneficiary storage _beneficiary = _beneficiaries[_beneficiaryAddress];

        if (
            _beneficiary.state == BeneficiaryState.Valid ||
            _beneficiary.state == BeneficiaryState.Locked
        ) {
            _changeBeneficiaryState(_beneficiary, BeneficiaryState.Removed);
            emit BeneficiaryRemoved(msg.sender, _beneficiaryAddress);
        }
    }

    /**
     * @notice Removes beneficiaries
     *
     * @param _beneficiaryAddresses addresses of beneficiaries to be removed
     */
    function _removeBeneficiaries(address[] memory _beneficiaryAddresses) internal {
        uint256 _index;
        uint256 _numberOfBeneficiaries = _beneficiaryAddresses.length;

        for (; _index < _numberOfBeneficiaries; _index++) {
            _removeBeneficiary(_beneficiaryAddresses[_index]);
        }
    }

    /**
     * @notice Checks a manager signature
     *
     * @param _expirationTimestamp  timestamp when the signature will expire/expired
     * @param _signature            the signature of a manager
     */
    function _checkManagerSignature(uint256 _expirationTimestamp, bytes calldata _signature)
        internal
    {
        require(
            msg.sender == communityAdmin.authorizedWalletAddress(),
            "Community: Sender must be the backend wallet"
        );
        require(_expirationTimestamp >= block.timestamp, "Community: Signature too old");

        bytes32 _messageHash = keccak256(
            abi.encodePacked(msg.sender, address(this), _expirationTimestamp)
        );

        address _signerAddress = _messageHash.toEthSignedMessageHash().recover(_signature);
        require(hasRole(MANAGER_ROLE, _signerAddress), "Community: Invalid signature");
    }

    function _beneficiaryClaimedAmount(Beneficiary storage _beneficiary)
        internal
        view
        returns (uint256)
    {
        uint256 _tokensLength = tokens.length;
        if (_tokensLength < 2) {
            return _beneficiary.claimedAmount;
        }

        uint256 _computedClaimAmount = _beneficiary.claimedAmount;

        //if beneficiary didn't claim for a long time and the token has been changed,
        //we multiply the claimed amount with all token ratios that user haven't claimed
        for (
            uint256 _index = _tokensLength - 1;
            tokens[_index].startBlock > _beneficiary.lastClaim;
            _index--
        ) {
            _computedClaimAmount = (_computedClaimAmount * tokens[_index].ratio) / 1e18;
        }

        return _computedClaimAmount;
    }

    /**
     * @notice Adds a new manager
     *
     * @param _account address of the manager to be added
     */
    function _addManager(address _account) internal {
        if (!hasRole(MANAGER_ROLE, _account)) {
            super._grantRole(MANAGER_ROLE, _account);
            emit ManagerAdded(msg.sender, _account);
        }
    }

    function _updateClaimAmount() internal {
        uint256 _newClaimAmount;
        uint256 _minClaimAmountRatio = communityAdmin.minClaimAmountRatio();
        uint256 _minClaimAmountRatioPrecision = communityAdmin.minClaimAmountRatioPrecision();

        if (
            validBeneficiaryCount == 0 ||
            isSelfFunding() ||
            _minClaimAmountRatio <= _minClaimAmountRatioPrecision
        ) {
            _newClaimAmount = originalClaimAmount;
        } else {
            _newClaimAmount = token().balanceOf(address(this)) / validBeneficiaryCount;

            uint256 _minimumClaimAmount = (originalClaimAmount * _minClaimAmountRatioPrecision) /
                _minClaimAmountRatio;

            if (_newClaimAmount < _minimumClaimAmount) {
                _newClaimAmount = _minimumClaimAmount;
            } else if (_newClaimAmount > originalClaimAmount) {
                _newClaimAmount = originalClaimAmount;
            }
        }

        if (_newClaimAmount != claimAmount) {
            emit ClaimAmountUpdated(claimAmount, _newClaimAmount);
            claimAmount = _newClaimAmount;
        }
    }
}
