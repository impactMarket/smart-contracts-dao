//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/ITreasury.sol";

import "hardhat/console.sol";

contract DonationMiner is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event RewardClaimed(address indexed user, uint256 amount);
    event DonationAdded(address indexed user, uint256 amount);

    IERC20 public immutable cUSD;
    IERC20 public immutable IPCT;
    ITreasury public treasury;
    uint256 public rewardPeriodSize;
    uint256 public startingBlock;
    uint256 public rewardPerBlock;

    struct RewardPeriod {
        uint256 reward; // Reward tokens created per block.
        uint256 bonusReward; // Reward tokens from previous periods.
        uint256 startBlock; // The block number at which reward distribution starts.
        uint256 endBlock; // The block number at which reward distribution ends.
        uint256 donations; // Total of donations for this rewardPeriod.
    }

    struct Donation {
        uint256 rewardPeriodNumber;
        uint256 amount;
    }

    struct User {
        uint256 donationsCount;
        uint256 lastClaim;
        mapping(uint256 => Donation) donations;
    }

    mapping(uint256 => RewardPeriod) public rewardPeriods;
    mapping(address => User) public users;

    uint256 public rewardPeriodCount;

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(block.number >= startingBlock, "DonationMiner: ERR_NOT_STARTED");
        _;
    }

    constructor(
        IERC20 _cUSD,
        IERC20 _IPCT,
        ITreasury _treasury,
        uint256 _rewardPerBlock,
        uint256 _rewardPeriodSize,
        uint256 _startingBlock
    ) {
        require(address(_cUSD) != address(0), "DonationMiner::constructor: _cUSD address not set!");
        require(address(_IPCT) != address(0), "DonationMiner::constructor: _IPCT address not set!");
        require(address(_treasury) != address(0), "DonationMiner::constructor: _treasury not set!");
        require(_rewardPerBlock != 0, "DonationMiner::constructor: _rewardPerBlock not set!");
        require(_startingBlock != 0, "DonationMiner::constructor: _startingRewardPeriod not set!");

        cUSD = _cUSD;
        IPCT = _IPCT;
        treasury = _treasury;
        startingBlock = _startingBlock;
        rewardPeriodSize = _rewardPeriodSize;
        rewardPerBlock = _rewardPerBlock;

        rewardPeriods[0].endBlock = _startingBlock - 1;
    }

    function setRewardPeriodSize(uint256 _rewardPeriodSize) external onlyOwner {
        rewardPeriodSize = _rewardPeriodSize;
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param _amount Amount of cUSD tokens to deposit.
     */
    function donate(uint256 _amount) external whenNotPaused whenStarted nonReentrant {
        _createRewardPeriods();

        // Transfer the cUSD from the user to the treasury
        cUSD.safeTransferFrom(msg.sender, address(treasury), _amount);

        RewardPeriod storage currentPeriod = rewardPeriods[rewardPeriodCount];
        currentPeriod.donations = currentPeriod.donations + _amount;

        User storage user = users[msg.sender];
        user.donationsCount++;

        Donation storage donation = user.donations[user.donationsCount];
        donation.rewardPeriodNumber = rewardPeriodCount;
        donation.amount = _amount;

        emit DonationAdded(msg.sender, _amount);
    }

    /**
     * @dev Calculate and claim all pending rewards for a user
     */
    function claimRewards() external whenNotPaused whenStarted nonReentrant {
        User storage user = users[msg.sender];
        uint256 claimAmount;

        while (user.lastClaim < user.donationsCount) {
            user.lastClaim++;
            Donation storage donation = user.donations[user.lastClaim];
            RewardPeriod storage rewardPeriod = rewardPeriods[donation.rewardPeriodNumber];

            if (rewardPeriod.endBlock >= block.number) {
                user.lastClaim--;
                break;
            }
            claimAmount +=
                ((rewardPeriod.reward + rewardPeriod.bonusReward) * donation.amount) /
                rewardPeriod.donations;
        }

        if (claimAmount > 0) {
            require(
                IPCT.balanceOf(address(this)) >= claimAmount,
                "DonationMiner::claimRewards: ERR_REWARD_TOKEN_BALANCE"
            );
            IPCT.safeTransfer(msg.sender, claimAmount);
        }

        emit RewardClaimed(msg.sender, claimAmount);
    }

    /**
     * @dev View function to see pending rewards on frontend.
     * @param _user Address of a specific user.
     * @return Pending rewards.
     */
    function estimateClaimableReward(address _user)
        external
        view
        whenStarted
        whenNotPaused
        returns (uint256)
    {
        User storage user = users[_user];
        uint256 toClaim = user.lastClaim + 1;

        uint256 claimAmount;

        while (toClaim <= user.donationsCount) {
            Donation storage donation = user.donations[toClaim];
            RewardPeriod storage rewardPeriod = rewardPeriods[donation.rewardPeriodNumber];

            claimAmount +=
                ((rewardPeriod.reward + rewardPeriod.bonusReward) * donation.amount) /
                rewardPeriod.donations;
            toClaim++;
        }

        return claimAmount;
    }

    function _calculateReward(uint256 _startBlock, uint256 _endBlock)
        internal
        view
        returns (uint256)
    {
        return (_endBlock - _startBlock) * rewardPerBlock;
    }

    /**
     * @dev Create all reward periods from the past
     */
    function _createRewardPeriods() internal {
        RewardPeriod storage lastPeriod = rewardPeriods[rewardPeriodCount];

        while (lastPeriod.endBlock < block.number) {
            rewardPeriodCount++;
            RewardPeriod storage newPeriod = rewardPeriods[rewardPeriodCount];
            newPeriod.startBlock = lastPeriod.endBlock + 1;
            newPeriod.endBlock = newPeriod.startBlock + rewardPeriodSize;
            newPeriod.reward = _calculateReward(newPeriod.startBlock, newPeriod.endBlock);
            if (lastPeriod.donations == 0) {
                newPeriod.bonusReward = lastPeriod.reward + lastPeriod.bonusReward;
            }

            lastPeriod = newPeriod;
        }
    }
}
