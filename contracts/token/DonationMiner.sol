//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ITreasury.sol";
import "../community/interfaces/ICommunity.sol";
import "../community/interfaces/ICommunityAdmin.sol";

import "hardhat/console.sol";
import "./interfaces/IDonationMiner.sol";

contract DonationMiner is IDonationMiner, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event RewardClaimed(address indexed donor, uint256 amount);
    event DonationAdded(address indexed donor, uint256 amount);

    IERC20 private immutable _cUSD;
    IERC20 private immutable _IPCT;
    ITreasury private _treasury;
    uint256 private _rewardPeriodSize;
    uint256 private _startingBlock;
    uint256 private _rewardPerBlock;
    uint256 private _rewardPeriodCount;

    mapping(uint256 => RewardPeriod) private _rewardPeriods;
    mapping(address => Donor) private _donors;

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(block.number >= _startingBlock, "DonationMiner: ERR_NOT_STARTED");
        _;
    }

    constructor(
        IERC20 cUSD_,
        IERC20 IPCT_,
        ITreasury treasury_,
        uint256 rewardPerBlock_,
        uint256 rewardPeriodSize_,
        uint256 startingBlock_
    ) {
        require(address(cUSD_) != address(0), "DonationMiner::constructor: _cUSD address not set!");
        require(address(IPCT_) != address(0), "DonationMiner::constructor: _IPCT address not set!");
        require(address(treasury_) != address(0), "DonationMiner::constructor: _treasury not set!");
        require(rewardPerBlock_ != 0, "DonationMiner::constructor: _rewardPerBlock not set!");
        require(startingBlock_ != 0, "DonationMiner::constructor: _startingRewardPeriod not set!");

        _cUSD = cUSD_;
        _IPCT = IPCT_;
        _treasury = treasury_;
        _startingBlock = startingBlock_;
        _rewardPeriodSize = rewardPeriodSize_;
        _rewardPerBlock = rewardPerBlock_;

        _rewardPeriods[0].endBlock = startingBlock_ - 1;
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

    function rewardPerBlock() external view override returns (uint256) {
        return _rewardPerBlock;
    }

    function rewardPeriodCount() external view override returns (uint256) {
        return _rewardPeriodCount;
    }

    function rewardPeriods(uint256 period)
        external
        view
        override
        returns (
            uint256 reward,
            uint256 bonusReward,
            uint256 startBlock,
            uint256 endBlock,
            uint256 donationsAmount
        )
    {
        reward = _rewardPeriods[period].reward;
        bonusReward = _rewardPeriods[period].bonusReward;
        startBlock = _rewardPeriods[period].startBlock;
        endBlock = _rewardPeriods[period].endBlock;
        donationsAmount = _rewardPeriods[period].donationsAmount;
    }

    function donors(address donor)
        external
        view
        override
        returns (uint256 donationsCount, uint256 lastClaim)
    {
        donationsCount = _donors[donor].donationsCount;
        lastClaim = _donors[donor].lastClaim;
    }

    function donations(address donor, uint256 donationId)
        external
        view
        override
        returns (uint256 rewardPeriodNumber, uint256 amount)
    {
        rewardPeriodNumber = _donors[donor].donations[donationId].rewardPeriodNumber;
        amount = _donors[donor].donations[donationId].amount;
    }

    function setRewardPeriodSize(uint256 rewardPeriodSize_) external override onlyOwner {
        _rewardPeriodSize = rewardPeriodSize_;
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param amount_ Amount of cUSD tokens to deposit.
     */
    function donate(uint256 amount_) external override whenNotPaused whenStarted nonReentrant {
        createRewardPeriods();

        // Transfer the cUSD from the donor to the treasury
        _cUSD.safeTransferFrom(msg.sender, address(_treasury), amount_);

        createDonation(amount_);
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

        createRewardPeriods();
        community_.donate(msg.sender, amount_);
        createDonation(amount_);
    }

    /**
     * @dev Calculate and claim all pending rewards for a donor
     */
    function claimRewards() external override whenNotPaused whenStarted nonReentrant {
        Donor storage donor = _donors[msg.sender];
        uint256 claimAmount;

        while (donor.lastClaim < donor.donationsCount) {
            donor.lastClaim++;
            Donation storage donation = donor.donations[donor.lastClaim];
            RewardPeriod storage rewardPeriod = _rewardPeriods[donation.rewardPeriodNumber];

            if (rewardPeriod.endBlock >= block.number) {
                donor.lastClaim--;
                break;
            }
            claimAmount +=
                ((rewardPeriod.reward + rewardPeriod.bonusReward) * donation.amount) /
                rewardPeriod.donationsAmount;
        }

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
        Donor storage donor = _donors[donor_];
        uint256 toClaim = donor.lastClaim + 1;

        uint256 claimAmount;

        while (toClaim <= donor.donationsCount) {
            Donation storage donation = donor.donations[toClaim];
            RewardPeriod storage rewardPeriod = _rewardPeriods[donation.rewardPeriodNumber];

            claimAmount +=
                ((rewardPeriod.reward + rewardPeriod.bonusReward) * donation.amount) /
                rewardPeriod.donationsAmount;
            toClaim++;
        }

        return claimAmount;
    }

    function calculateReward(uint256 startBlock_, uint256 endBlock_)
        internal
        view
        returns (uint256)
    {
        return (endBlock_ - startBlock_) * _rewardPerBlock;
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
            newPeriod.reward = calculateReward(newPeriod.startBlock, newPeriod.endBlock);
            if (lastPeriod.donationsAmount == 0) {
                newPeriod.bonusReward = lastPeriod.reward + lastPeriod.bonusReward;
            }

            lastPeriod = newPeriod;
        }
    }

    function createDonation(uint256 amount_) internal {
        RewardPeriod storage currentPeriod = _rewardPeriods[_rewardPeriodCount];
        currentPeriod.donationsAmount = currentPeriod.donationsAmount + amount_;

        Donor storage donor = _donors[msg.sender];
        donor.donationsCount++;

        Donation storage donation = donor.donations[donor.donationsCount];
        donation.rewardPeriodNumber = _rewardPeriodCount;
        donation.amount = amount_;

        emit DonationAdded(msg.sender, amount_);
    }
}
