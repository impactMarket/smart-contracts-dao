// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
contract Community is
    CommunityStorageV1,
    Initializable,
    AccessControlUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
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
     * @param managers_            Community's initial managers.
     *                             Will be able to add others
     * @param claimAmount_         Base amount to be claim by the beneficiary
     * @param maxClaim_            Limit that a beneficiary can claim in total
     * @param decreaseStep_        Value decreased from maxClaim each time a beneficiary is added
     * @param baseInterval_        Base interval to start claiming
     * @param incrementInterval_   Increment interval used in each claim
     * @param previousCommunity_   Previous smart contract address of community
     * @param minTranche_          Minimum amount that the community will receive when requesting funds
     * @param maxTranche_          Maximum amount that the community will receive when requesting funds
     */
    function initialize(
        address[] memory managers_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        uint256 minTranche_,
        uint256 maxTranche_,
        ICommunity previousCommunity_
    ) external initializer {
        require(
            baseInterval_ > incrementInterval_,
            "Community::initialize: baseInterval must be greater than incrementInterval"
        );
        require(
            maxClaim_ > claimAmount_,
            "Community::initialize: maxClaim must be greater than claimAmount"
        );

        require(
            minTranche_ <= maxTranche_,
            "Community::initialize: minTranche should not be greater than maxTranche"
        );

        __AccessControl_init();
        __Ownable_init();
        __ReentrancyGuard_init();

        claimAmount = claimAmount_;
        baseInterval = baseInterval_;
        incrementInterval = incrementInterval_;
        maxClaim = maxClaim_;
        minTranche = minTranche_;
        maxTranche = maxTranche_;
        previousCommunity = previousCommunity_;
        communityAdmin = ICommunityAdmin(msg.sender);
        decreaseStep = decreaseStep_;
        locked = false;

        transferOwnership(msg.sender);

        // MANAGER_ROLE is the admin for the MANAGER_ROLE
        // so every manager is able to add or remove other managers
        _setRoleAdmin(MANAGER_ROLE, MANAGER_ROLE);

        _setupRole(MANAGER_ROLE, msg.sender);
        emit ManagerAdded(msg.sender, msg.sender);

        for (uint256 i = 0; i < managers_.length; i++) {
            addManager(managers_[i]);
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

    //    /**
    //     * @notice Returns details of a beneficiary
    //     *
    //     * @param beneficiary_ address of the beneficiary
    //     * @return state beneficiary state
    //     * @return claims total number of claims
    //     * @return claimedAmount total amount of cUSD received
    //     * @return lastClaim block number of the last claim
    //     */
    //    function beneficiaries(address beneficiary_)
    //        external
    //        view
    //        override
    //        returns (
    //            BeneficiaryState state,
    //            uint256 claims,
    //            uint256 claimedAmount,
    //            uint256 lastClaim
    //        )
    //    {
    //        state = beneficiaries[beneficiary_].state;
    //        claims = beneficiaries[beneficiary_].claims;
    //        claimedAmount = beneficiaries[beneficiary_].claimedAmount;
    //        lastClaim = beneficiaries[beneficiary_].lastClaim;
    //    }

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
     * @param newCommunityAdmin_ address of the new communityAdmin
     */
    function updateCommunityAdmin(ICommunityAdmin newCommunityAdmin_) external override onlyOwner {
        address oldCommunityAdminAddress = address(communityAdmin);
        communityAdmin = newCommunityAdmin_;

        addManager(address(communityAdmin));

        emit CommunityAdminUpdated(oldCommunityAdminAddress, address(newCommunityAdmin_));
    }

    /** Updates the address of the previousCommunity
     *
     * @param newPreviousCommunity_ address of the new previousCommunity
     */
    function updatePreviousCommunity(ICommunity newPreviousCommunity_) external override onlyOwner {
        address oldPreviousCommunityAddress = address(previousCommunity);
        previousCommunity = newPreviousCommunity_;

        emit PreviousCommunityUpdated(oldPreviousCommunityAddress, address(newPreviousCommunity_));
    }

    /** Updates beneficiary params
     *
     * @param claimAmount_  base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim  in total
     * @param decreaseStep_ value decreased from maxClaim each time a is beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     */
    function updateBeneficiaryParams(
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

        uint256 oldClaimAmount = claimAmount;
        uint256 oldMaxClaim = maxClaim;
        uint256 oldDecreaseStep = decreaseStep;
        uint256 oldBaseInterval = baseInterval;
        uint256 oldIncrementInterval = incrementInterval;

        claimAmount = claimAmount_;
        maxClaim = maxClaim_;
        decreaseStep = decreaseStep_;
        baseInterval = baseInterval_;
        incrementInterval = incrementInterval_;

        emit BeneficiaryParamsUpdated(
            oldClaimAmount,
            oldMaxClaim,
            oldDecreaseStep,
            oldBaseInterval,
            oldIncrementInterval,
            claimAmount_,
            maxClaim_,
            decreaseStep_,
            baseInterval_,
            incrementInterval_
        );
    }

    /** @notice Updates params of a community
     *
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     */
    function updateCommunityParams(uint256 minTranche_, uint256 maxTranche_)
        external
        override
        onlyOwner
    {
        require(
            minTranche_ <= maxTranche_,
            "Community::updateCommunityParams: minTranche should not be greater than maxTranche"
        );

        uint256 oldMinTranche = minTranche;
        uint256 oldMaxTranche = maxTranche;

        minTranche = minTranche_;
        maxTranche = maxTranche_;

        emit CommunityParamsUpdated(oldMinTranche, oldMaxTranche, minTranche_, maxTranche_);
    }

    /**
     * @notice Adds a new manager
     *
     * @param account_ address of the manager to be added
     */
    function addManager(address account_) public override onlyManagers {
        if (!hasRole(MANAGER_ROLE, account_)) {
            super.grantRole(MANAGER_ROLE, account_);
            emit ManagerAdded(msg.sender, account_);
        }
    }

    /**
     * @notice Remove an existing manager
     *
     * @param account_ address of the manager to be removed
     */
    function removeManager(address account_) external override onlyManagers {
        require(
            hasRole(MANAGER_ROLE, account_),
            "Community::removeManager: This account doesn't have manager role"
        );
        require(
            account_ != address(communityAdmin),
            "Community::removeManager: You are not allow to remove communityAdmin"
        );
        super.revokeRole(MANAGER_ROLE, account_);
        emit ManagerRemoved(msg.sender, account_);
    }

    /**
     * @notice Enforces managers to use addManager method
     */
    function grantRole(bytes32 role, address account) public override {
        require(false, "Community::grantRole: You are not allow to use this method");
    }

    /**
     * @notice Enforces managers to use removeManager method
     */
    function revokeRole(bytes32 role, address account) public override {
        require(false, "Community::revokeRole: You are not allow to use this method");
    }

    /**
     * @notice Adds a new beneficiary
     *
     * @param beneficiaryAddress_ address of the beneficiary to be added
     */
    function addBeneficiary(address beneficiaryAddress_)
        external
        override
        onlyManagers
        nonReentrant
    {
        Beneficiary storage beneficiary = beneficiaries[beneficiaryAddress_];
        require(
            beneficiary.state == BeneficiaryState.NONE,
            "Community::addBeneficiary: Beneficiary exists"
        );
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Valid);
        // solhint-disable-next-line not-rely-on-time
        beneficiary.lastClaim = block.number;

        // send default amount when adding a new beneficiary
        cUSD().safeTransfer(beneficiaryAddress_, DEFAULT_AMOUNT);

        emit BeneficiaryAdded(msg.sender, beneficiaryAddress_);
    }

    /**
     * @notice Locks a valid beneficiary
     *
     * @param beneficiaryAddress_ address of the beneficiary to be locked
     */
    function lockBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = beneficiaries[beneficiaryAddress_];

        require(beneficiary.state == BeneficiaryState.Valid, "Community::lockBeneficiary: NOT_YET");
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Locked);
        emit BeneficiaryLocked(msg.sender, beneficiaryAddress_);
    }

    /**
     * @notice  Unlocks a locked beneficiary
     *
     * @param beneficiaryAddress_ address of the beneficiary to be unlocked
     */
    function unlockBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = beneficiaries[beneficiaryAddress_];

        require(
            beneficiary.state == BeneficiaryState.Locked,
            "Community::unlockBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Valid);
        emit BeneficiaryUnlocked(msg.sender, beneficiaryAddress_);
    }

    /**
     * @notice Remove an existing beneficiary
     *
     * @param beneficiaryAddress_ address of the beneficiary to be removed
     */
    function removeBeneficiary(address beneficiaryAddress_) external override onlyManagers {
        Beneficiary storage beneficiary = beneficiaries[beneficiaryAddress_];

        require(
            beneficiary.state == BeneficiaryState.Valid ||
                beneficiary.state == BeneficiaryState.Locked,
            "Community::removeBeneficiary: NOT_YET"
        );
        _changeBeneficiaryState(beneficiary, BeneficiaryState.Removed);
        emit BeneficiaryRemoved(msg.sender, beneficiaryAddress_);
    }

    /**
     * @dev Transfers cUSD to a valid beneficiary
     */
    function claim() external override onlyValidBeneficiary nonReentrant {
        Beneficiary storage beneficiary = beneficiaries[msg.sender];

        require(!locked, "LOCKED");
        require(claimCooldown(msg.sender) <= block.number, "Community::claim: NOT_YET");
        require(
            (beneficiary.claimedAmount + claimAmount) <= maxClaim,
            "Community::claim: MAX_CLAIM"
        );

        beneficiary.claimedAmount += claimAmount;
        beneficiary.claims++;
        beneficiary.lastClaim = block.number;

        cUSD().safeTransfer(msg.sender, claimAmount);
        emit BeneficiaryClaim(msg.sender, claimAmount);
    }

    /**
     * @notice Returns the number of blocks that a beneficiary have to wait between claims
     *
     * @param beneficiaryAddress_ address of the beneficiary
     * @return uint256 number of blocks for the lastInterval
     */
    function lastInterval(address beneficiaryAddress_) public view override returns (uint256) {
        Beneficiary storage beneficiary = beneficiaries[beneficiaryAddress_];
        if (beneficiary.claims == 0) {
            return 0;
        }
        return baseInterval + (beneficiary.claims - 1) * incrementInterval;
    }

    /**
     * @notice Returns the block number when a beneficiary can claim again
     *
     * @param beneficiaryAddress_ address of the beneficiary
     * @return uint256 number of block when the beneficiary can claim
     */
    function claimCooldown(address beneficiaryAddress_) public view override returns (uint256) {
        return beneficiaries[beneficiaryAddress_].lastClaim + lastInterval(beneficiaryAddress_);
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

        emit FundsRequested(msg.sender);
    }

    /**
     * @notice Transfers cUSDs from donor to this community
     * Used by donationToCommunity method from DonationMiner contract
     *
     * @param sender_ address of the sender
     * @param amount_ amount to be donated
     */
    function donate(address sender_, uint256 amount_) external override nonReentrant {
        cUSD().safeTransferFrom(sender_, address(this), amount_);
        privateFunds += amount_;

        emit Donate(msg.sender, amount_);
    }

    /**
     * @notice Increases the treasuryFunds value
     * Used by communityAdmin after an amount of cUSD are sent from the treasury
     *
     * @param amount_ amount to be added to treasuryFunds
     */
    function addTreasuryFunds(uint256 amount_) external override onlyOwner {
        treasuryFunds += amount_;
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param token_ address of the ERC20 token
     * @param to_ address of the receiver
     * @param amount_ amount of the transaction
     */
    function transfer(
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }

    /**
     * @notice Allows a beneficiary from the previousCommunity to join in this community
     */
    function beneficiaryJoinFromMigrated() external override {
        // no need to check if it's a beneficiary, as the state is copied
        Beneficiary storage beneficiary = beneficiaries[msg.sender];

        require(
            beneficiary.state == BeneficiaryState.NONE,
            "Community::beneficiaryJoinFromMigrated: Beneficiary exists"
        );

        //if the previousCommunity is deployed with the new type of smart contract
        if (previousCommunity.impactMarketAddress() == address(0)) {
            (
                BeneficiaryState oldBeneficiaryState,
                uint256 oldBeneficiaryClaims,
                uint256 oldBeneficiaryClaimedAmount,
                uint256 oldBeneficiaryLastClaim
            ) = previousCommunity.beneficiaries(msg.sender);

            _changeBeneficiaryState(beneficiary, oldBeneficiaryState);
            beneficiary.claims = oldBeneficiaryClaims;
            beneficiary.lastClaim = oldBeneficiaryLastClaim;
            beneficiary.claimedAmount = oldBeneficiaryClaimedAmount;
        } else {
            ICommunityOld oldCommunity = ICommunityOld(address(previousCommunity));
            uint256 oldBeneficiaryLastInterval = oldCommunity.lastInterval(msg.sender);
            _changeBeneficiaryState(
                beneficiary,
                BeneficiaryState(oldCommunity.beneficiaries(msg.sender))
            );

            uint256 oldBeneficiaryCooldown = oldCommunity.cooldown(msg.sender);

            if (oldBeneficiaryCooldown >= oldBeneficiaryLastInterval + _firstBlockTimestamp()) {
                // seconds to blocks conversion
                beneficiary.lastClaim =
                    (oldBeneficiaryCooldown - oldBeneficiaryLastInterval - _firstBlockTimestamp()) /
                    5;
            } else {
                beneficiary.lastClaim = 0;
            }

            beneficiary.claimedAmount = oldCommunity.claimed(msg.sender);

            uint256 previousBaseInterval = oldCommunity.baseInterval();
            if (oldBeneficiaryLastInterval >= previousBaseInterval) {
                beneficiary.claims =
                    (oldBeneficiaryLastInterval - previousBaseInterval) /
                    oldCommunity.incrementInterval() +
                    1;
            } else {
                beneficiary.claims = 0;
            }
        }

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
     * @param beneficiary address of the beneficiary
     * @param newState_ new state
     */
    function _changeBeneficiaryState(Beneficiary storage beneficiary, BeneficiaryState newState_)
        internal
    {
        if (beneficiary.state == newState_) {
            return;
        }

        beneficiaryList.add(msg.sender);

        if (newState_ == BeneficiaryState.Valid) {
            require(
                maxClaim - decreaseStep >= claimAmount,
                "Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
            );
            validBeneficiaryCount++;
            maxClaim -= decreaseStep;
        } else if (beneficiary.state == BeneficiaryState.Valid) {
            validBeneficiaryCount--;
            maxClaim += decreaseStep;
        }

        beneficiary.state = newState_;
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
