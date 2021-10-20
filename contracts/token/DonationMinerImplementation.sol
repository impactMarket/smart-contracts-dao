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
     * @param community   Address of the community for donateToCommunity case
     *                    or address of the DonationMiner contract otherwise
     */
    event DonationAdded(
        uint256 indexed donationId,
        address indexed donor,
        uint256 amount,
        address indexed community
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
        require(block.number >= _startingBlock, "DonationMiner: ERR_NOT_STARTED");
        _;
    }

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
        _startingBlock = startingBlock_;
        _rewardPeriodSize = rewardPeriodSize_;
        _decayNumerator = decayNumerator_;
        _decayDenominator = decayDenominator_;

        _rewardPeriodCount = 1;
        RewardPeriod storage firstPeriod = _rewardPeriods[1];
        firstPeriod.startBlock = _startingBlock;
        firstPeriod.endBlock = _startingBlock + _rewardPeriodSize;
        firstPeriod.rewardPerBlock = firstRewardPerBlock_;
        firstPeriod.rewardAmount = firstRewardPerBlock_ * _rewardPeriodSize;
    }

    function cUSD() external view override returns (IERC20) {
        return _cUSD;
    }

    function IPCT() external view override returns (IERC20) {
        return _IPCT;
    }

    function treasury() external view override returns (ITreasury) {
        return _treasury;
    }

    function rewardPeriodSize() external view override returns (uint256) {
        return _rewardPeriodSize;
    }

    function startingBlock() external view override returns (uint256) {
        return _startingBlock;
    }

    function rewardPeriodCount() external view override returns (uint256) {
        return _rewardPeriodCount;
    }

    function donationCount() external view override returns (uint256) {
        return _donationCount;
    }

    function decay() external view override returns (uint256) {
        return _decayNumerator;
    }

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

    function rewardPeriodDonorAmount(uint256 period, address donor)
        external
        view
        override
        returns (uint256)
    {
        return _rewardPeriods[period].donorAmounts[donor];
    }

    function donors(address donor)
        external
        view
        override
        returns (uint256 rewardPeriodsCount, uint256 lastClaim)
    {
        rewardPeriodsCount = _donors[donor].rewardPeriodsCount;
        lastClaim = _donors[donor].lastClaim;
    }

    function donorRewardPeriod(address donor, uint256 rewardPeriodIndex)
        external
        view
        override
        returns (uint256 rewardPeriodNumber, uint256 amount)
    {
        rewardPeriodNumber = _donors[donor].rewardPeriods[rewardPeriodIndex];
        amount = _rewardPeriods[rewardPeriodNumber].donorAmounts[donor];
    }

    function donation(uint256 index) external view override returns (Donation memory) {
        return _donations[index];
    }

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

    function updateTreasury(ITreasury newTreasury_) external override onlyOwner {
        address oldTreasuryAddress = address(_treasury);
        _treasury = newTreasury_;

        emit TreasuryUpdated(oldTreasuryAddress, address(_treasury));
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param amount_ Amount of cUSD tokens to deposit.
     */
    function donate(uint256 amount_) external override whenNotPaused whenStarted nonReentrant {
        // Transfer the cUSD from the donor to the treasury
        _cUSD.safeTransferFrom(msg.sender, address(_treasury), amount_);

        createDonation(amount_, address(this));
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param amount_ Amount of cUSD tokens to deposit.
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
        createDonation(amount_, address(community_));
    }

    /**
     * @dev Claim all pending rewards for a donor
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
     * @dev Calculate all pending rewards for a donor
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
     * @dev View function to see pending rewards on frontend.
     * @param donor_ Address of a specific donor.
     * @return Pending rewards.
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

        // if donor have donated in current rewardPeriod
        if (lastRewardPeriod.endBlock >= block.number) {
            claimAmount +=
                (lastRewardPeriod.rewardAmount * lastRewardPeriod.donorAmounts[donor_]) /
                lastRewardPeriod.donationsAmount;
        }

        return claimAmount;
    }

    function calculateRewardPerBlock(uint256 periodNumber_) public view returns (uint256) {
        return
            (_rewardPeriods[periodNumber_ - 1].rewardPerBlock * _decayNumerator) /
            _decayDenominator;
    }

    function transfer(
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }

    /**
     * @dev Create all reward periods from the past
     */
    function createRewardPeriods() internal {
        RewardPeriod storage lastPeriod = _rewardPeriods[_rewardPeriodCount];

        while (lastPeriod.endBlock < block.number) {
            _rewardPeriodCount++;
            RewardPeriod storage newPeriod = _rewardPeriods[_rewardPeriodCount];
            newPeriod.startBlock = lastPeriod.endBlock + 1;
            newPeriod.endBlock = newPeriod.startBlock + _rewardPeriodSize;
            newPeriod.rewardPerBlock = calculateRewardPerBlock(_rewardPeriodCount);
            if (lastPeriod.donationsAmount == 0) {
                newPeriod.rewardAmount =
                    _rewardPeriodSize *
                    newPeriod.rewardPerBlock +
                    lastPeriod.rewardAmount;
            }

            lastPeriod = newPeriod;
        }
    }

    //if community != address(this), the donation is sent to the community
    function createDonation(uint256 amount_, address community_) internal {
        createRewardPeriods();

        _donationCount++;
        Donation storage donation = _donations[_donationCount];
        donation.donor = msg.sender;
        donation.community = community_;
        donation.amount = amount_;
        donation.rewardPeriod = _rewardPeriodCount;

        addAmountToCurrentRewardPeriod(amount_);
        addCurrentRewardPeriodToDonor();

        emit DonationAdded(_donationCount, msg.sender, amount_, community_);
    }

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

    function addCurrentRewardPeriodToDonor() internal {
        Donor storage donor = _donors[msg.sender];
        uint256 lastDonorRewardPeriod = donor.rewardPeriods[donor.rewardPeriodsCount];

        //add current reward period id to the donor's list
        //only if this reward period id hasn't been added yet
        if (lastDonorRewardPeriod != _rewardPeriodCount) {
            donor.rewardPeriodsCount++;
            donor.rewardPeriods[donor.rewardPeriodsCount] = _rewardPeriodCount;
        }
    }

    function addAmountToCurrentRewardPeriod(uint256 amount_) internal {
        RewardPeriod storage currentPeriod = _rewardPeriods[_rewardPeriodCount];
        currentPeriod.donationsAmount += amount_;
        currentPeriod.donorAmounts[msg.sender] += amount_;
    }
}
