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
    uint256 public blocksInRewardPeriod;
    uint256 public startingRewardPeriod;

    struct RewardPeriodUserInfo {
        uint256 donationAmount; // How many cUSD tokens the user has provided this rewardPeriod.
        uint256 claimedDonationAmount; // Amount of cUSD tokens  for which the reward was requested by user
        uint256 rewardDebt; // Mining reward owed for this rewardPeriod    //to be deleted
        uint256 rewardCredited; // Mining reward claimed for this rewardPeriod  //to be deleted
    }

    struct RewardPeriodReward {
        uint256 accRewardPerShare; // Accumulated reward per share, times 1e12. See below.
        uint256 rewardPerBlock; // Reward tokens created per block.
        uint256 startBlock; // The block number at which reward distribution starts.
        uint256 endBlock; // The block number at which reward distribution ends.
        uint256 rewardPeriodSpan; // The number of rewardPeriods to look back and ratio your contribution.
        uint256 donations; // Total of donations for this rewardPeriod.
        uint256 claimedDonations; // Amount of cUSD tokens  for which the reward was requested by all users
        uint256 ipctClaimed; // Amount of cUSD tokens  for which the reward was requested by all users
        mapping(address => RewardPeriodUserInfo) rewardPeriodUsers;
    }

    mapping(uint256 => RewardPeriodReward) private rewards;
    mapping(address => uint256) private userLastClaimedRewardPeriod;

    /**
     * @notice Enforces values > 0 only
     */
    modifier greaterThanZero(uint256 _value) {
        require(_value > 0, "ERR_ZERO_VALUE");
        _;
    }

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(_getCurrentRewardPeriod() >= startingRewardPeriod, "ERR_NOT_STARTED");
        _;
    }

    constructor(
        IERC20 _cUSD,
        IERC20 _IPCT,
        uint256 _startingRewardPerBlock,
        uint256 _blocksInRewardPeriod,
        uint256 _startingRewardPeriod,
        uint256 _startingRewardPeriodRatioSpan,
        address _treasuryAddress
    ) {
        require(address(_cUSD) != address(0), "_cUSD address not set!");
        require(address(_IPCT) != address(0), "_IPCT address not set!");
        require(address(_treasuryAddress) != address(0), "_treasuryAddress not set!");

        require(_startingRewardPerBlock != 0, "_startingRewardPerBlock not set!");
        require(_startingRewardPeriod != 0, "_startingRewardPeriod not set!");
        // require(_startingRewardPeriod > _getCurrentRewardPeriod(), "_startingRewardPeriod must be in future!");
        require(_startingRewardPeriodRatioSpan != 0, "_startingRewardPeriodRatioSpan not set!");

        cUSD = _cUSD;
        IPCT = _IPCT;
        treasuryAddress = _treasuryAddress;
        startingRewardPeriod = _startingRewardPeriod;
        blocksInRewardPeriod = _blocksInRewardPeriod;

        uint256 startBlockForRewardPeriod = _getStartBlockForRewardPeriod(_startingRewardPeriod);

        RewardPeriodReward storage beginningRewardPeriod = rewards[_startingRewardPeriod];
        beginningRewardPeriod.accRewardPerShare = 0;
        beginningRewardPeriod.rewardPerBlock = _startingRewardPerBlock;
        beginningRewardPeriod.startBlock = startBlockForRewardPeriod;
        beginningRewardPeriod.endBlock = _getEndBlockForRewardPeriod(_startingRewardPeriod);
        beginningRewardPeriod.rewardPeriodSpan = _startingRewardPeriodRatioSpan; //to be deleted
        beginningRewardPeriod.donations = 0;
    }

    function _getCurrentRewardPeriod() internal view returns (uint256) {
        return
            block.number < blocksInRewardPeriod
                ? 0
                : (block.number - (block.number % blocksInRewardPeriod)) / blocksInRewardPeriod;
    }

    function _getEndBlockForRewardPeriod(uint256 rewardPeriod) internal view returns (uint256) {
        return _getStartBlockForRewardPeriod(rewardPeriod + 1) - 1;
    }

    function _getStartBlockForRewardPeriod(uint256 rewardPeriod) internal view returns (uint256) {
        return rewardPeriod * blocksInRewardPeriod;
    }

    function _getRewardPerBlockByRewardPeriod(uint256 _rewardPeriod)
        internal
        view
        returns (uint256)
    {
        return _rewardPeriod < 10 ? 100 : 90;
    }

    /**
     * @dev Update reward variables of the given rewardPeriod
     */
    function _updateRewardPeriod(uint256 _rewardPeriod) internal {
        RewardPeriodReward storage currentReward = rewards[_rewardPeriod];

        if (currentReward.endBlock != 0) {
            return;
        }

        currentReward.startBlock = _getStartBlockForRewardPeriod(_rewardPeriod);
        currentReward.endBlock = _getEndBlockForRewardPeriod(_rewardPeriod);
        currentReward.rewardPerBlock = _getRewardPerBlockByRewardPeriod(_rewardPeriod);
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
        // Get data for current rewardPeriod
        uint256 currentRewardPeriod = _getCurrentRewardPeriod();
        RewardPeriodReward storage currentReward = rewards[currentRewardPeriod];
        RewardPeriodUserInfo storage currentUser = currentReward.rewardPeriodUsers[msg.sender];

        // Update aggregated calculations
        _updateRewardPeriod(currentRewardPeriod);

        // Transfer the cUSD from the user to the treasury
        cUSD.safeTransferFrom(address(msg.sender), address(treasuryAddress), _amount);

        currentUser.donationAmount = currentUser.donationAmount + _amount;
        currentReward.donations = currentReward.donations + _amount;

        emit Donation(msg.sender, _amount);
    }

    /**
     * @dev Calculate and claim all pending rewards for a user
     */
    function claimRewards() external whenNotPaused whenStarted nonReentrant {
        uint256 claimAmount;
        uint256 currentRewardPeriod = _getCurrentRewardPeriod();
        uint256 claimFromRewardPeriod = userLastClaimedRewardPeriod[msg.sender];

        // Iterate all pending rewardPeriods for a user and add up their rewards
        while (claimFromRewardPeriod < currentRewardPeriod) {
            claimAmount = claimAmount + _calculateReward(msg.sender, claimFromRewardPeriod);
            claimFromRewardPeriod++;
        }

        // Check we have enough IPCT to transfer
        require(IPCT.balanceOf(address(this)) >= claimAmount, "ERR_REWARD_TOKEN_BALANCE");

        // Update their last claimed rewardPeriod
        userLastClaimedRewardPeriod[msg.sender] = currentRewardPeriod;

        if (claimAmount > 0) {
            IPCT.safeTransfer(msg.sender, claimAmount);
        }
        emit RewardClaim(msg.sender, claimAmount);
    }

    //    /**
    //     * @dev View function to see pending rewards on frontend.
    //     * @param _user Address of a specific user.
    //     * @return Pending rewards.
    //     */
    //    function estimateClaimableReward(address _user)
    //        external
    //        view
    //        whenStarted
    //        whenNotPaused
    //        returns (uint256)
    //    {
    //        uint256 claimAmount;
    //        uint256 currentRewardPeriod = _getCurrentRewardPeriod();
    //        uint256 claimFromRewardPeriod = Math.max(1, userLastClaimedRewardPeriod[msg.sender]);
    //
    //        // Iterate all pending rewardPeriods for a user and add up their rewards
    //        while (claimFromRewardPeriod <= currentRewardPeriod) {
    //            uint256 tmpAccRewardPerShare = rewards[claimFromRewardPeriod].accRewardPerShare;
    //            uint256 donations = rewards[claimFromRewardPeriod].donations;
    //
    //            if (donations > 0) {
    //                uint256 endBlock = Math.min(block.number, rewards[claimFromRewardPeriod].endBlock);
    //                uint256 blockCount = endBlock - rewards[claimFromRewardPeriod].lastRewardBlock;
    //                uint256 newRewards = blockCount * rewards[claimFromRewardPeriod].rewardPerBlock;
    //                tmpAccRewardPerShare = tmpAccRewardPerShare + ((newRewards * 1e12) / donations);
    //            }
    //            claimAmount =
    //                claimAmount +
    //                (((rewards[claimFromRewardPeriod].rewardPeriodUsers[_user].donationAmount *
    //                    tmpAccRewardPerShare) / 1e12) -
    //                    rewards[claimFromRewardPeriod].rewardPeriodUsers[_user].rewardCredited);
    //            claimFromRewardPeriod++;
    //        }
    //        return claimAmount;
    //    }

    /**
     * @dev Calculate claimable rewards for an rewardPeriod, for a user
     * @param _user User to claim for
     * @param _rewardPeriod RewardPeriod to claim rewards for
     * @return uint256 Amount to claim for this rewardPeriod
     */
    function _calculateReward(address _user, uint256 _rewardPeriod) internal returns (uint256) {
        RewardPeriodReward storage period = rewards[_rewardPeriod];
        RewardPeriodUserInfo storage rewardPeriodUser = period.rewardPeriodUsers[_user];

        uint256 userAmountToClaim = rewardPeriodUser.donationAmount -
            rewardPeriodUser.claimedDonationAmount;

        if (userAmountToClaim == 0) {
            return 0;
        }

        // Update aggregate statistics for this rewardPeriod
        _updateRewardPeriod(_rewardPeriod);

        uint256 periodLastMinedBlock = (block.number > period.endBlock)
            ? period.endBlock
            : block.number;
        uint256 blocksMined = periodLastMinedBlock - period.startBlock + 1;
        uint256 periodReward = blocksMined * period.rewardPerBlock;

        uint256 userReward = ((periodReward - period.ipctClaimed) * userAmountToClaim) /
            (period.donations - period.claimedDonations);

        //        console.log("*****************************************************************************");
        //        console.log("rewardPeriodUser.donationAmount", rewardPeriodUser.donationAmount);
        //        console.log("rewardPeriodUser.claimedDonationAmount", rewardPeriodUser.claimedDonationAmount);
        //        console.log("userAmountToClaim", userAmountToClaim);
        //        console.log("periodReward", periodReward);
        //        console.log("period.ipctClaimed", period.ipctClaimed);
        //        console.log("period.donations", period.donations);
        //        console.log("period.claimedDonations", period.claimedDonations);
        //        console.log("userReward", userReward);

        period.ipctClaimed = period.ipctClaimed + userReward;
        period.claimedDonations = period.claimedDonations + userAmountToClaim;
        rewardPeriodUser.claimedDonationAmount =
            rewardPeriodUser.claimedDonationAmount +
            userAmountToClaim;

        //        console.log("period.ipctClaimed", period.ipctClaimed);
        //        console.log("period.donations", period.donations);
        //        console.log("rewardPeriodUser.claimedDonationAmount", rewardPeriodUser.claimedDonationAmount);

        return userReward;
    }
}
