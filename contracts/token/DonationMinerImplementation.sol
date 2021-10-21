//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/DonationMinerStorageV1.sol";
import "../community/interfaces/ICommunity.sol";
import "../community/interfaces/ICommunityAdmin.sol";
import "../lib/ABDKMath64x64.sol";

import "hardhat/console.sol";

contract DonationMinerImplementation is
    DonationMinerStorageV1,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a donation has been added
     *
     * @param donationId  Id of the donation
     * @param donor       Address of the donner
     * @param amount      Value of the donation
     * @param target      Address of the receiver (community or treasury)
     *                    or address of the DonationMiner contract otherwise
     */
    event DonationAdded(
        uint256 indexed donationId,
        address indexed donor,
        uint256 amount,
        address indexed target
    );

    /**
     * @notice Triggered when a donor has claimed his reward
     *
     * @param donor       Address of the donner
     * @param amount      Value of the reward
     */
    event RewardClaimed(address indexed donor, uint256 amount);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Triggered when reward period params have been updated
     *
     * @param oldRewardPeriodSize   Old rewardPeriodSize value
     * @param oldDecayNumerator     Old decayNumerator value
     * @param oldDecayDenominator   Old decayDenominator value
     * @param newRewardPeriodSize   New rewardPeriodSize value
     * @param newDecayNumerator     New decayNumerator value
     * @param newDecayDenominator   New decayDenominator value
     *
     * For further information regarding each parameter, see
     * *DonationMiner* smart contract initialize method.
     */
    event RewardPeriodParamsUpdated(
        uint256 oldRewardPeriodSize,
        uint256 oldDecayNumerator,
        uint256 oldDecayDenominator,
        uint256 newRewardPeriodSize,
        uint256 newDecayNumerator,
        uint256 newDecayDenominator
    );

    /**
     * @notice Triggered when the treasury address has been updated
     *
     * @param oldTreasury             Old treasury address
     * @param newTreasury             New treasury address
     */
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(block.number >= _rewardPeriods[1].startBlock, "DonationMiner: ERR_NOT_STARTED");
        _;
    }

    /**
     * @notice Used to initialize a new DonationMiner contract
     *
     * @param cUSD_                 Address of the cUSD token
     * @param IPCT_                 Address of the IPCT token
     * @param treasury_             Address of the Treasury
     * @param firstRewardPerBlock_  Number of IPCTs given for each block
     *                              from the first reward period
     * @param rewardPeriodSize_     Number of blocks of the reward period
     * @param startingBlock_        First block of the first reward period
     * @param decayNumerator_       Decay numerator used for calculating
                                    the new reward per block based on
                                    the previous reward per block
     * @param decayDenominator_     Decay denominator used for calculating
                                    the new reward per block based on
                                    the previous reward per block
     */
    function initialize(
        IERC20 cUSD_,
        IERC20 IPCT_,
        ITreasury treasury_,
        uint256 firstRewardPerBlock_,
        uint256 rewardPeriodSize_,
        uint256 startingBlock_,
        uint256 decayNumerator_,
        uint256 decayDenominator_
    ) public override initializer {
        require(address(cUSD_) != address(0), "DonationMiner::initialize: cUSD address not set");
        require(address(IPCT_) != address(0), "DonationMiner::initialize: IPCT address not set");
        require(address(treasury_) != address(0), "DonationMiner::initialize: treasury_ not set");
        require(
            firstRewardPerBlock_ != 0,
            "DonationMiner::initialize: firstRewardPerBlock not set!"
        );
        require(startingBlock_ != 0, "DonationMiner::initialize: startingRewardPeriod not set!");

        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _cUSD = cUSD_;
        _IPCT = IPCT_;
        _treasury = treasury_;
        _rewardPeriodSize = rewardPeriodSize_;
        _decayNumerator = decayNumerator_;
        _decayDenominator = decayDenominator_;

        _rewardPeriodCount = 1;
        RewardPeriod storage firstPeriod = _rewardPeriods[1];
        firstPeriod.startBlock = startingBlock_;
        firstPeriod.endBlock = startingBlock_ + _rewardPeriodSize;
        firstPeriod.rewardPerBlock = firstRewardPerBlock_;
        firstPeriod.rewardAmount = firstRewardPerBlock_ * _rewardPeriodSize;
    }

    /**
     * @notice Returns the cUSD contract address
     */
    function cUSD() external view override returns (IERC20) {
        return _cUSD;
    }

    /**
     * @notice Returns the IPCT contract address
     */
    function IPCT() external view override returns (IERC20) {
        return _IPCT;
    }

    /**
     * @notice Returns the Treasury contract address
     */
    function treasury() external view override returns (ITreasury) {
        return _treasury;
    }

    /**
     * @notice Returns the number of blocks of a reward period
     */
    function rewardPeriodSize() external view override returns (uint256) {
        return _rewardPeriodSize;
    }

    /**
     * @notice Returns the number of reward periods that has been created
     */
    function rewardPeriodCount() external view override returns (uint256) {
        return _rewardPeriodCount;
    }

    /**
     * @notice Returns the number of donations
     */
    function donationCount() external view override returns (uint256) {
        return _donationCount;
    }

    /**
     * @notice Returns the decayNumerator value
     */
    function decayNumerator() external view override returns (uint256) {
        return _decayNumerator;
    }

    /**
     * @notice Returns the decayDenominator value
     */
    function decayDenominator() external view override returns (uint256) {
        return _decayDenominator;
    }

    /**
     * @notice Returns the details of a reward period
     *
     * @param period index of the reward period
     * @return rewardPerBlock number of IPCTs rewarded for each block of this reward period
     * @return rewardAmount total number of IPCTs available for this reward period
     * @return startBlock first block of this reward period
     * @return endBlock last block of this reward period
     * @return donationsAmount total donations amount of this reward period
     */
    function rewardPeriods(uint256 period)
        external
        view
        override
        returns (
            uint256 rewardPerBlock,
            uint256 rewardAmount,
            uint256 startBlock,
            uint256 endBlock,
            uint256 donationsAmount
        )
    {
        rewardPerBlock = _rewardPeriods[period].rewardPerBlock;
        rewardAmount = _rewardPeriods[period].rewardAmount;
        startBlock = _rewardPeriods[period].startBlock;
        endBlock = _rewardPeriods[period].endBlock;
        donationsAmount = _rewardPeriods[period].donationsAmount;
    }

    /**
     * @notice Returns the amount of cUSD donated by a user in a reward period
     *
     * @param period number of the reward period
     * @param donor address of the donor
     * @return uint256 amount of cUSD donated by the user in this reward period
     */
    function rewardPeriodDonorAmount(uint256 period, address donor)
        external
        view
        override
        returns (uint256)
    {
        return _rewardPeriods[period].donorAmounts[donor];
    }

    /**
     * @notice Returns the details of a donor
     *
     * @param donor address of the donor
     * @return rewardPeriodsCount number of reward periods in which the user has donated
     * @return lastClaim index of the last reward period for which the user has claimed
     */
    function donors(address donor)
        external
        view
        override
        returns (uint256 rewardPeriodsCount, uint256 lastClaim)
    {
        rewardPeriodsCount = _donors[donor].rewardPeriodsCount;
        lastClaim = _donors[donor].lastClaim;
    }

    /**
     * @notice Returns a reward period number from a donor reward period list
     *
     * @param donor address of the donor
     * @param rewardPeriodIndex index of the reward period
     * @return uint256 number of the reward period
     */
    function donorRewardPeriod(address donor, uint256 rewardPeriodIndex)
        external
        view
        override
        returns (uint256)
    {
        return _donors[donor].rewardPeriods[rewardPeriodIndex];
    }

    /**
     * @notice Returns the details of a donation contract address
     *
     * @param index donation index
     * @return donor address of the donner
     * @return target address of the receiver (community or treasury)
     * @return rewardPeriod number of the reward period in which the donation was made
     * @return blockNumber number of the block in which the donation was executed
     * @return amount amount of the donation
     * @return token address of the token
     * @return tokenPrice the price of the token in cUSD
     */
    function donation(uint256 index)
        external
        view
        override
        returns (
            address donor,
            address target,
            uint256 rewardPeriod,
            uint256 blockNumber,
            uint256 amount,
            IERC20 token,
            uint256 tokenPrice
        )
    {
        donor = _donations[index].donor;
        target = _donations[index].target;
        rewardPeriod = _donations[index].rewardPeriod;
        blockNumber = _donations[index].blockNumber;
        amount = _donations[index].amount;
        token = _donations[index].token;
        tokenPrice = _donations[index].tokenPrice;
    }

    /**
     * @notice Updates reward period default params
     *
     * @param newRewardPeriodSize_ value of new _rewardPeriodSize
     * @param newDecayNumerator_ value of new _decayNumerator
     * @param newDecayDenominator_ value of new _decayDenominator
     */
    function updateRewardPeriodParams(
        uint256 newRewardPeriodSize_,
        uint256 newDecayNumerator_,
        uint256 newDecayDenominator_
    ) external override onlyOwner {
        uint256 oldRewardPeriodSize_ = _rewardPeriodSize;
        uint256 oldDecayNumerator_ = _decayNumerator;
        uint256 oldDecayDenominator_ = _decayDenominator;

        _rewardPeriodSize = newRewardPeriodSize_;
        _decayNumerator = newDecayNumerator_;
        _decayDenominator = newDecayDenominator_;

        emit RewardPeriodParamsUpdated(
            oldRewardPeriodSize_,
            oldDecayNumerator_,
            oldDecayDenominator_,
            newRewardPeriodSize_,
            newDecayNumerator_,
            newDecayDenominator_
        );
    }

    /**
     * @notice Updates Treasury address
     *
     * @param newTreasury_ address of new treasury_ contract
     */
    function updateTreasury(ITreasury newTreasury_) external override onlyOwner {
        address oldTreasuryAddress = address(_treasury);
        _treasury = newTreasury_;

        emit TreasuryUpdated(oldTreasuryAddress, address(_treasury));
    }

    /**
     * @notice Transfers cUSD tokens to the treasury contract
     *
     * @param amount_ Amount of cUSD tokens to deposit.
     */
    function donate(uint256 amount_) external override whenNotPaused whenStarted nonReentrant {
        // Transfer the cUSD from the donor to the treasury
        _cUSD.safeTransferFrom(msg.sender, address(_treasury), amount_);

        addDonation(msg.sender, amount_, address(_treasury));
    }

    /**
     * @dev Transfers cUSD tokens to the community contract
     *
     * @param community_ address of the community
     * @param amount_ amount of cUSD tokens to deposit
     */
    function donateToCommunity(ICommunity community_, uint256 amount_)
        external
        override
        whenNotPaused
        whenStarted
        nonReentrant
    {
        ICommunityAdmin communityAdmin = _treasury.communityAdmin();
        require(
            communityAdmin.communities(address(community_)) == ICommunityAdmin.CommunityState.Valid,
            "DonationMiner::donateToCommunity: This is not a valid community address"
        );
        // Transfer the cUSD from the donor to the community
        community_.donate(msg.sender, amount_);
        addDonation(msg.sender, amount_, address(community_));
    }

    /**
     * @notice Transfers to the sender the rewards from ended reward periods
     */
    function claimRewards() external override whenNotPaused whenStarted nonReentrant {
        Donor storage donor = _donors[msg.sender];
        uint256 claimAmount = calculateClaimableRewards(msg.sender);
        donor.lastClaim = getDonorLastEndedRewardPeriodIndex(donor);

        if (claimAmount > 0) {
            require(
                _IPCT.balanceOf(address(this)) >= claimAmount,
                "DonationMiner::claimRewards: ERR_REWARD_TOKEN_BALANCE"
            );
            _IPCT.safeTransfer(msg.sender, claimAmount);
        }

        emit RewardClaimed(msg.sender, claimAmount);
    }

    /**
     * @notice Calculates the rewards from ended reward periods of a donor
     *
     * @param donor_ address of the donor
     * @return uint256 sum of all donor's rewards that has not been claimed yet
     */
    function calculateClaimableRewards(address donor_) public view override returns (uint256) {
        Donor storage donor = _donors[donor_];
        uint256 claimAmount;
        uint256 rewardPeriodNumber;
        uint256 lastEndedRewardPeriodIndex = getDonorLastEndedRewardPeriodIndex(donor);
        uint256 index = donor.lastClaim + 1;

        while (index <= lastEndedRewardPeriodIndex) {
            rewardPeriodNumber = donor.rewardPeriods[index];
            RewardPeriod storage rewardPeriod = _rewardPeriods[rewardPeriodNumber];

            claimAmount +=
                (rewardPeriod.rewardAmount * rewardPeriod.donorAmounts[msg.sender]) /
                rewardPeriod.donationsAmount;
            index++;
        }

        return claimAmount;
    }

    /**
     * @notice Calculates the estimate reward of a donor for current reward period
     *
     * @param donor_ address of the donor
     * @return uint256 reward that donor will receive in current reward period if there isn't another donation
     */
    function estimateClaimableReward(address donor_)
        external
        view
        override
        whenStarted
        whenNotPaused
        returns (uint256)
    {
        RewardPeriod storage lastRewardPeriod = _rewardPeriods[_rewardPeriodCount];

        uint256 claimAmount;

        if (isCurrentRewardPeriodInitialized()) {
            claimAmount +=
                (lastRewardPeriod.rewardAmount * lastRewardPeriod.donorAmounts[donor_]) /
                lastRewardPeriod.donationsAmount;
        }

        return claimAmount;
    }

    /**
     * @notice Calculates the number of IPCTs given for each block in current reward period
     *
     * @return uint256 current reward per block
     */
    function calculateRewardPerBlock() internal view returns (uint256) {
        return
            (_rewardPeriods[_rewardPeriodCount - 1].rewardPerBlock * _decayNumerator) /
            _decayDenominator;
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
     * @notice Initializes all reward periods that haven't been initialized yet until the current one.
     *         The first donor in a reward period will pay for that operation.
     */
    function initializeRewardPeriods() internal {
        RewardPeriod storage lastPeriod = _rewardPeriods[_rewardPeriodCount];

        while (lastPeriod.endBlock < block.number) {
            _rewardPeriodCount++;
            RewardPeriod storage newPeriod = _rewardPeriods[_rewardPeriodCount];
            newPeriod.startBlock = lastPeriod.endBlock + 1;
            newPeriod.endBlock = newPeriod.startBlock + _rewardPeriodSize;
            newPeriod.rewardPerBlock = calculateRewardPerBlock();
            if (lastPeriod.donationsAmount == 0) {
                newPeriod.rewardAmount =
                    _rewardPeriodSize *
                    newPeriod.rewardPerBlock +
                    lastPeriod.rewardAmount;
            }

            lastPeriod = newPeriod;
        }
    }

    /**
     * @notice Adds a new donation in donations list
     *
     * @param donor_ address of the donner
     * @param amount_ amount of the donation
     * @param target_ address of the receiver (community or treasury)
     */
    function addDonation(
        address donor_,
        uint256 amount_,
        address target_
    ) internal {
        initializeRewardPeriods();

        Donation storage donation = _donations[_donationCount];
        donation.donor = donor_;
        donation.target = target_;
        donation.amount = amount_;
        donation.rewardPeriod = _rewardPeriodCount;
        donation.token = _cUSD;
        donation.tokenPrice = 1e18;

        updateRewardPeriodAmounts(_rewardPeriodCount, msg.sender, amount_);
        addCurrentRewardPeriodToDonor(msg.sender);

        emit DonationAdded(_donationCount, msg.sender, amount_, target_);
    }

    /**
     * @notice Returns the index of the last ended reward period in which a donor has donated
     *
     * @param donor object of the donor
     * @return uint256 the index of the last ended reward period of the donor
     */
    function getDonorLastEndedRewardPeriodIndex(Donor storage donor)
        internal
        view
        returns (uint256)
    {
        uint256 lastDonorRewardPeriod = donor.rewardPeriods[donor.rewardPeriodsCount];
        if (_rewardPeriods[lastDonorRewardPeriod].endBlock < block.number) {
            return donor.rewardPeriodsCount;
        } else {
            return donor.rewardPeriodsCount - 1;
        }
    }

    /**
     * @notice Adds the current reward period number to a donor's list only if it hasn't been added yet
     *
     * @param donor_ address of the donor
     */
    function addCurrentRewardPeriodToDonor(address donor_) internal {
        Donor storage donor = _donors[donor_];
        uint256 lastDonorRewardPeriod = donor.rewardPeriods[donor.rewardPeriodsCount];

        //ensures that the current reward period number hasn't been added in the donor's list
        if (lastDonorRewardPeriod != _rewardPeriodCount) {
            donor.rewardPeriodsCount++;
            donor.rewardPeriods[donor.rewardPeriodsCount] = _rewardPeriodCount;
        }
    }

    /**
     * @notice Updates the amounts of a reward period
     *
     * @param rewardPeriodNumber_ number of the reward period
     * @param donor_ address of the donor
     * @param amount_ amount to be added
     */
    function updateRewardPeriodAmounts(
        uint256 rewardPeriodNumber_,
        address donor_,
        uint256 amount_
    ) internal {
        RewardPeriod storage currentPeriod = _rewardPeriods[rewardPeriodNumber_];
        currentPeriod.donationsAmount += amount_;
        currentPeriod.donorAmounts[donor_] += amount_;
    }

    /**
     * @notice Checks if current reward period has been initialized
     *
     * @return bool true if current reward period has been initialized
     */
    function isCurrentRewardPeriodInitialized() internal view returns (bool) {
        return _rewardPeriods[_rewardPeriodCount].endBlock >= block.number;
    }
}
