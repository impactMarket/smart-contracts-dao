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
        require(block.number >= rewardPeriods[1].startBlock, "DonationMiner: ERR_NOT_STARTED");
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
    ) public initializer {
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

        cUSD = cUSD_;
        IPCT = IPCT_;
        treasury = treasury_;
        rewardPeriodSize = rewardPeriodSize_;
        decayNumerator = decayNumerator_;
        decayDenominator = decayDenominator_;

        rewardPeriodCount = 1;
        RewardPeriod storage firstPeriod = rewardPeriods[1];
        firstPeriod.startBlock = startingBlock_;
        firstPeriod.endBlock = startingBlock_ + rewardPeriodSize - 1;
        firstPeriod.rewardPerBlock = firstRewardPerBlock_;
        firstPeriod.rewardAmount = firstRewardPerBlock_ * rewardPeriodSize;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    //    /**
    //     * @notice Returns the details of a reward period
    //     *
    //     * @param period index of the reward period
    //     * @return rewardPerBlock number of IPCTs rewarded for each block of this reward period
    //     * @return rewardAmount total number of IPCTs available for this reward period
    //     * @return startBlock first block of this reward period
    //     * @return endBlock last block of this reward period
    //     * @return donationsAmount total donations amount of this reward period
    //     */
    //    function rewardPeriods(uint256 period)
    //        external
    //        view
    //        override
    //        returns (
    //            uint256 rewardPerBlock,
    //            uint256 rewardAmount,
    //            uint256 startBlock,
    //            uint256 endBlock,
    //            uint256 donationsAmount
    //        )
    //    {
    //        rewardPerBlock = rewardPeriods[period].rewardPerBlock;
    //        rewardAmount = rewardPeriods[period].rewardAmount;
    //        startBlock = rewardPeriods[period].startBlock;
    //        endBlock = rewardPeriods[period].endBlock;
    //        donationsAmount = rewardPeriods[period].donationsAmount;
    //    }

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
        return rewardPeriods[period].donorAmounts[donor];
    }

    //    /**
    //     * @notice Returns the details of a donor
    //     *
    //     * @param donor address of the donor
    //     * @return rewardPeriodsCount number of reward periods in which the user has donated
    //     * @return lastClaim index of the last reward period for which the user has claimed
    //     */
    //    function donors(address donor)
    //        external
    //        view
    //        override
    //        returns (uint256 rewardPeriodsCount, uint256 lastClaim)
    //    {
    //        rewardPeriodsCount = donors[donor].rewardPeriodsCount;
    //        lastClaim = donors[donor].lastClaim;
    //    }

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
        return donors[donor].rewardPeriods[rewardPeriodIndex];
    }

    //    /**
    //     * @notice Returns the details of a donation contract address
    //     *
    //     * @param index donation index
    //     * @return donor address of the donner
    //     * @return target address of the receiver (community or treasury)
    //     * @return rewardPeriod number of the reward period in which the donation was made
    //     * @return blockNumber number of the block in which the donation was executed
    //     * @return amount amount of the donation
    //     * @return token address of the token
    //     * @return tokenPrice the price of the token in cUSD
    //     */
    //    function donations(uint256 index)
    //        external
    //        view
    //        override
    //        returns (
    //            address donor,
    //            address target,
    //            uint256 rewardPeriod,
    //            uint256 blockNumber,
    //            uint256 amount,
    //            IERC20 token,
    //            uint256 tokenPrice
    //        )
    //    {
    //        donor = donations[index].donor;
    //        target = donations[index].target;
    //        rewardPeriod = donations[index].rewardPeriod;
    //        blockNumber = donations[index].blockNumber;
    //        amount = donations[index].amount;
    //        token = donations[index].token;
    //        tokenPrice = donations[index].tokenPrice;
    //    }

    /**
     * @notice Updates reward period default params
     *
     * @param newRewardPeriodSize_ value of new rewardPeriodSize
     * @param newDecayNumerator_ value of new decayNumerator
     * @param newDecayDenominator_ value of new decayDenominator
     */
    function updateRewardPeriodParams(
        uint256 newRewardPeriodSize_,
        uint256 newDecayNumerator_,
        uint256 newDecayDenominator_
    ) external override onlyOwner {
        uint256 oldRewardPeriodSize_ = rewardPeriodSize;
        uint256 oldDecayNumerator_ = decayNumerator;
        uint256 oldDecayDenominator_ = decayDenominator;

        rewardPeriodSize = newRewardPeriodSize_;
        decayNumerator = newDecayNumerator_;
        decayDenominator = newDecayDenominator_;

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
        address oldTreasuryAddress = address(treasury);
        treasury = newTreasury_;

        emit TreasuryUpdated(oldTreasuryAddress, address(newTreasury_));
    }

    /**
     * @notice Transfers cUSD tokens to the treasury contract
     *
     * @param amount_ Amount of cUSD tokens to deposit.
     */
    function donate(uint256 amount_) external override whenNotPaused whenStarted nonReentrant {
        // Transfer the cUSD from the donor to the treasury
        cUSD.safeTransferFrom(msg.sender, address(treasury), amount_);

        addDonation(msg.sender, amount_, address(treasury));
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
        ICommunityAdmin communityAdmin = treasury.communityAdmin();
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
        Donor storage donor = donors[msg.sender];
        uint256 claimAmount = calculateClaimableRewards(msg.sender);
        donor.lastClaim = getDonorLastEndedRewardPeriodIndex(donor);

        if (claimAmount == 0) {
            return;
        }

        if (claimAmount > IPCT.balanceOf(address(this))) {
            claimAmount = IPCT.balanceOf(address(this));
        }

        IPCT.safeTransfer(msg.sender, claimAmount);

        emit RewardClaimed(msg.sender, claimAmount);
    }

    /**
     * @notice Calculates the rewards from ended reward periods of a donor
     *
     * @param donor_ address of the donor
     * @return uint256 sum of all donor's rewards that has not been claimed yet
     */
    function calculateClaimableRewards(address donor_) public view override returns (uint256) {
        Donor storage donor = donors[donor_];
        uint256 claimAmount;
        uint256 rewardPeriodNumber;
        uint256 lastEndedRewardPeriodIndex = getDonorLastEndedRewardPeriodIndex(donor);
        uint256 index = donor.lastClaim + 1;

        while (index <= lastEndedRewardPeriodIndex) {
            rewardPeriodNumber = donor.rewardPeriods[index];
            RewardPeriod storage rewardPeriod = rewardPeriods[rewardPeriodNumber];

            claimAmount +=
                (rewardPeriod.rewardAmount * rewardPeriod.donorAmounts[donor_]) /
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
        RewardPeriod storage lastRewardPeriod = rewardPeriods[rewardPeriodCount];

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
            (rewardPeriods[rewardPeriodCount - 1].rewardPerBlock * decayNumerator) /
            decayDenominator;
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
        RewardPeriod storage lastPeriod = rewardPeriods[rewardPeriodCount];

        while (lastPeriod.endBlock < block.number) {
            rewardPeriodCount++;
            RewardPeriod storage newPeriod = rewardPeriods[rewardPeriodCount];
            newPeriod.startBlock = lastPeriod.endBlock + 1;
            newPeriod.endBlock = newPeriod.startBlock + rewardPeriodSize - 1;
            newPeriod.rewardPerBlock = calculateRewardPerBlock();
            uint256 rewardAmount = rewardPeriodSize * newPeriod.rewardPerBlock;
            if (lastPeriod.donationsAmount == 0) {
                rewardAmount += lastPeriod.rewardAmount;
            }
            newPeriod.rewardAmount = rewardAmount;
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

        donationCount++;
        Donation storage donation = donations[donationCount];
        donation.donor = donor_;
        donation.target = target_;
        donation.amount = amount_;
        donation.blockNumber = block.number;
        donation.rewardPeriod = rewardPeriodCount;
        donation.token = cUSD;
        donation.tokenPrice = 1e18;

        updateRewardPeriodAmounts(rewardPeriodCount, msg.sender, amount_);
        addCurrentRewardPeriodToDonor(msg.sender);

        emit DonationAdded(donationCount, msg.sender, amount_, target_);
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
        if (rewardPeriods[lastDonorRewardPeriod].endBlock < block.number) {
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
        Donor storage donor = donors[donor_];
        uint256 lastDonorRewardPeriod = donor.rewardPeriods[donor.rewardPeriodsCount];

        //ensures that the current reward period number hasn't been added in the donor's list
        if (lastDonorRewardPeriod != rewardPeriodCount) {
            donor.rewardPeriodsCount++;
            donor.rewardPeriods[donor.rewardPeriodsCount] = rewardPeriodCount;
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
        RewardPeriod storage currentPeriod = rewardPeriods[rewardPeriodNumber_];
        currentPeriod.donationsAmount += amount_;
        currentPeriod.donorAmounts[donor_] += amount_;
    }

    /**
     * @notice Checks if current reward period has been initialized
     *
     * @return bool true if current reward period has been initialized
     */
    function isCurrentRewardPeriodInitialized() internal view returns (bool) {
        return rewardPeriods[rewardPeriodCount].endBlock >= block.number;
    }
}
