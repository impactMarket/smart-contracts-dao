//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract DonationMiner is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;
    using EnumerableSet for EnumerableSet.UintSet;

    event RewardClaim(address indexed user, uint256 amount);
    event Donation(address indexed user, uint256 amount);

    IERC20 public immutable cUSD;
    IERC20 public immutable IPCT;
    address public treasuryAddress;
    uint256 public constant BLOCKS_IN_EPOCH = 17280;
    uint256 public lastEpochUpdated;
    uint256 public startingEpoch;

    struct EpochUserInfo {
        uint256 donationAmount; // How many cUSD tokens the user has provided this epoch.
        uint256 rewardDebt; // Mining reward owed for this epoch
        uint256 rewardCredited; // Mining reward claimed for this epoch
    }

    struct EpochReward {
        uint256 lastRewardBlock; // Last block number that reward distribution occured.
        uint256 accRewardPerShare; // Accumulated reward per share, times 1e12. See below.
        uint256 rewardPerBlock; // Reward tokens created per block.
        uint256 startBlock; // The block number at which reward distribution starts.
        uint256 endBlock; // The block number at which reward distribution ends.
        uint256 epochSpan; // The number of epochs to look back and ratio your contribution.
        uint256 donations; // Total of donations for this epoch.
        mapping(address => EpochUserInfo) epochUsers;
    }

    mapping(uint256 => EpochReward) private rewards;
    mapping(address => uint256) private userLastClaimedEpoch;

    /**
     * @notice Enforces values > 0 only
     */
    modifier greaterThanZero(uint256 _value) {
        require(_value > 0, "ERR_ZERO_VALUE");
        _;
    }

    /**
     * @notice Enforces beginning epoch has started
     */
    modifier whenStarted() {
        require(_getCurrentEpoch() >= startingEpoch, "ERR_NOT_STARTED");
        _;
    }

    constructor(
        IERC20 _cUSD,
        IERC20 _IPCT,
        uint256 _startingRewardPerBlock,
        uint256 _startingEpoch,
        uint256 _startingEpochRatioSpan,
        address _treasuryAddress
    ) {
        require(address(_cUSD) != address(0), "_cUSD address not set!");
        require(address(_IPCT) != address(0), "_IPCT address not set!");
        require(address(_treasuryAddress) != address(0), "_treasuryAddress not set!");

        require(_startingRewardPerBlock != 0, "_startingRewardPerBlock not set!");
        require(_startingEpoch != 0, "_startingEpoch not set!");
        // require(_startingEpoch > _getCurrentEpoch(), "_startingEpoch must be in future!");
        require(_startingEpochRatioSpan != 0, "_startingEpochRatioSpan not set!");

        cUSD = _cUSD;
        IPCT = _IPCT;
        treasuryAddress = _treasuryAddress;
        lastEpochUpdated = _startingEpoch;
        startingEpoch = _startingEpoch;

        uint256 startBlockForEpoch = _getStartBlockForEpoch(_startingEpoch);

        EpochReward storage beginningEpoch = rewards[_startingEpoch];
        beginningEpoch.lastRewardBlock = startBlockForEpoch;
        beginningEpoch.accRewardPerShare = 0;
        beginningEpoch.rewardPerBlock = _startingRewardPerBlock;
        beginningEpoch.startBlock = startBlockForEpoch;
        beginningEpoch.endBlock = _getEndBlockForEpoch(_startingEpoch);
        beginningEpoch.epochSpan = _startingEpochRatioSpan;
        beginningEpoch.donations = 0;
    }

    function _getCurrentEpoch() internal view returns (uint256) {
        if (block.number < BLOCKS_IN_EPOCH) return 1;
        else return (block.number - (block.number % BLOCKS_IN_EPOCH)) / BLOCKS_IN_EPOCH;
    }

    function _getEndBlockForEpoch(uint256 epoch) internal pure returns (uint256) {
        return _getStartBlockForEpoch(epoch + 1) - 1;
    }

    function _getStartBlockForEpoch(uint256 epoch) internal pure returns (uint256) {
        return epoch * BLOCKS_IN_EPOCH;
    }

    /**
     * @dev Update reward variables of the given epoch
     */
    function _updateEpoch(uint256 epoch) internal {
        EpochReward storage currentReward = rewards[epoch];

        // Don't exceed the end of this epoch when calculating
        uint256 endBlock = Math.min(block.number, currentReward.endBlock);

        // If this is the very first donation, we cannot divide by zero
        // so simply return and wait for more donations before performing calculation
        if (currentReward.donations == 0) {
            currentReward.lastRewardBlock = endBlock;
            return;
        }

        // Calculate the number of blocks since last aggregation calculation
        uint256 blockCount = endBlock - currentReward.lastRewardBlock;

        // New rewards to distribute since last calculation
        uint256 newRewards = blockCount * currentReward.rewardPerBlock;

        // Increase accumulated reward per cUSD we share by the new rewards owed since last calculation
        currentReward.accRewardPerShare =
            currentReward.accRewardPerShare +
            ((newRewards * 1e12) / currentReward.donations); // might need to add multiplier here for floating point precision
        currentReward.lastRewardBlock = endBlock;
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param _amount Amount of cUSD tokens to deposit.
     */
    function donate(uint256 _amount)
        external
        greaterThanZero(_amount)
        whenNotPaused
        whenStarted
        nonReentrant
    {
        // Get data for current epoch
        uint256 currentEpoch = _getCurrentEpoch();
        EpochReward storage currentReward = rewards[currentEpoch];
        EpochUserInfo storage currentUser = currentReward.epochUsers[msg.sender];

        // Update aggregated calculations
        _updateEpoch(currentEpoch);

        // Transfer the cUSD from the user to the treasury
        cUSD.safeTransferFrom(address(msg.sender), address(treasuryAddress), _amount);

        // Update the donation amount and the user's current reward
        currentUser.donationAmount = currentUser.donationAmount + _amount;
        currentUser.rewardDebt =
            (currentUser.donationAmount * currentReward.accRewardPerShare) /
            1e12;

        // Update the total donations for this epoch
        currentReward.donations = currentReward.donations + _amount;

        // // Add to the user's set of epochs they have contributed to
        // if(!userEpochsPendingClaim[msg.sender].contains(currentEpoch)){
        //     userEpochsPendingClaim[msg.sender].add(currentEpoch);
        // }

        emit Donation(msg.sender, _amount);
    }

    /**
     * @dev Calculate and claim all pending rewards for a user
     */
    function claimRewards() external whenNotPaused whenStarted nonReentrant {
        uint256 claimAmount;
        uint256 currentEpoch = _getCurrentEpoch();
        uint256 claimFromEpoch = Math.max(1, userLastClaimedEpoch[msg.sender]);

        // Iterate all pending epochs for a user and add up their rewards
        while (claimFromEpoch <= currentEpoch) {
            claimAmount = claimAmount + _calculateReward(msg.sender, claimFromEpoch);
            claimFromEpoch++;
        }

        // Check we have enough IPCT to transfer
        require(IPCT.balanceOf(address(this)) >= claimAmount, "ERR_REWARD_TOKEN_BALANCE");

        // Update their last claimed epoch
        userLastClaimedEpoch[msg.sender] = currentEpoch;

        if (claimAmount > 0) {
            IPCT.safeTransfer(msg.sender, claimAmount);
        }
        emit RewardClaim(msg.sender, claimAmount);
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
        uint256 claimAmount;
        uint256 currentEpoch = _getCurrentEpoch();
        uint256 claimFromEpoch = Math.max(1, userLastClaimedEpoch[msg.sender]);

        // Iterate all pending epochs for a user and add up their rewards
        while (claimFromEpoch <= currentEpoch) {
            uint256 tmpAccRewardPerShare = rewards[claimFromEpoch].accRewardPerShare;
            uint256 donations = rewards[claimFromEpoch].donations;

            if (donations > 0) {
                uint256 endBlock = Math.min(block.number, rewards[claimFromEpoch].endBlock);
                uint256 blockCount = endBlock - rewards[claimFromEpoch].lastRewardBlock;
                uint256 newRewards = blockCount * rewards[claimFromEpoch].rewardPerBlock;
                tmpAccRewardPerShare = tmpAccRewardPerShare + ((newRewards * 1e12) / donations);
            }
            claimAmount =
                claimAmount +
                (((rewards[claimFromEpoch].epochUsers[_user].donationAmount *
                    tmpAccRewardPerShare) / 1e12) -
                    rewards[claimFromEpoch].epochUsers[_user].rewardCredited);
            claimFromEpoch++;
        }
        return claimAmount;
    }

    /**
     * @dev Calculate claimable rewards for an epoch, for a user
     * @param _user User to claim for
     * @param _epoch Epoch to claim rewards for
     * @return uint256 Amount to claim for this epoch
     */
    function _calculateReward(address _user, uint256 _epoch) internal returns (uint256) {
        EpochReward storage epochReward = rewards[_epoch];
        EpochUserInfo storage epochUser = epochReward.epochUsers[_user];

        // Update aggregate statistics for this epoch
        _updateEpoch(_epoch);

        // Update reward owed for this epoch
        epochUser.rewardDebt = (epochUser.donationAmount * epochReward.accRewardPerShare) / 1e12;

        // Get claim amount, could be zero if fully claimed
        uint256 claimAmount = epochUser.rewardDebt - epochUser.rewardCredited;

        // Update reward credited to equal the total debt
        epochUser.rewardCredited = epochUser.rewardCredited + claimAmount;

        return claimAmount;
    }
}
