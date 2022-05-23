//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "../../treasury/interfaces/ITreasury.sol";
import "../../staking/interfaces/IStaking.sol";

interface IDonationMiner {
    struct RewardPeriod {
        //reward tokens created per block
        uint256 rewardPerBlock;
        //reward tokens from previous periods + reward tokens from this reward period
        uint256 rewardAmount;
        //block number at which reward period starts
        uint256 startBlock;
        //block number at which reward period ends
        uint256 endBlock;
        //total of donations for this rewardPeriod
        uint256 donationsAmount;
        //amounts donated by every donor in this rewardPeriod
        mapping(address => uint256) donorAmounts;
        uint256 againstPeriods;
        //total stake amount at the end of this rewardPeriod
        uint256 stakesAmount;
        //ratio between 1 cUSD donated and 1 PACT staked
        uint256 stakingDonationRatio;
        //true if user has staked/unstaked in this reward period
        mapping(address => bool) hasSetStakeAmount;
        //stake amount of a user at the end of this reward period;
        //if a user doesn't stake/unstake in a reward period,
        //              this value will remain 0 (and hasSetStakeAmount will be false)
        //if hasNewStakeAmount is false it means the donorStakeAmount
        //              is the same as the last reward period where hasSetStakeAmount is true
        mapping(address => uint256) donorStakeAmounts;
    }

    struct Donor {
        uint256 lastClaim;  //last reward period index for which the donor has claimed the reward; used until v2
        uint256 rewardPeriodsCount; //total number of reward periods in which the donor donated
        mapping(uint256 => uint256) rewardPeriods; //list of all reward period ids in which the donor donated
        uint256 lastClaimPeriod; //last reward period id for which the donor has claimed the reward
    }

    struct Donation {
        address donor;  //address of the donner
        address target;  //address of the receiver (community or treasury)
        uint256 rewardPeriod;  //number of the reward period in which the donation was made
        uint256 blockNumber;  //number of the block in which the donation was executed
        uint256 amount;  //the convertedAmount value
        IERC20 token;  //address of the token
        uint256 initialAmount;  //number of tokens donated
    }

    function getVersion() external returns(uint256);
    function cUSD() external view returns (IERC20);
    function PACT() external view returns (IERC20);
    function treasury() external view returns (ITreasury);
    function staking() external view returns (IStaking);
    function rewardPeriodSize() external view returns (uint256);
    function decayNumerator() external view returns (uint256);
    function decayDenominator() external view returns (uint256);
    function stakingDonationRatio() external view returns (uint256);
    function communityDonationRatio() external view returns (uint256);
    function rewardPeriodCount() external view returns (uint256);
    function donationCount() external view returns (uint256);
    function rewardPeriods(uint256 _period) external view returns (
        uint256 rewardPerBlock,
        uint256 rewardAmount,
        uint256 startBlock,
        uint256 endBlock,
        uint256 donationsAmount,
        uint256 againstPeriods,
        uint256 stakesAmount,
        uint256 stakingDonationRatio

);
    function rewardPeriodDonorAmount(uint256 _period, address _donor) external view returns (uint256);
    function rewardPeriodDonorStakeAmounts(uint256 _period, address _donor) external view returns (uint256);
    function donors(address _donor) external view returns (
        uint256 rewardPeriodsCount,
        uint256 lastClaim,
        uint256 lastClaimPeriod
    );
    function donorRewardPeriod(address _donor, uint256 _rewardPeriodIndex) external view returns (uint256);
    function donations(uint256 _index) external view returns (
        address donor,
        address target,
        uint256 rewardPeriod,
        uint256 blockNumber,
        uint256 amount,
        IERC20 token,
        uint256 tokenPrice
    );
    function claimDelay() external view returns (uint256);
    function againstPeriods() external view returns (uint256);
    function updateRewardPeriodParams(
        uint256 _newRewardPeriodSize,
        uint256 _newDecayNumerator,
        uint256 _newDecayDenominator
    ) external;
    function updateClaimDelay(uint256 _newClaimDelay) external;
    function updateStakingDonationRatio(uint256 _newStakingDonationRatio) external;
    function updateCommunityDonationRatio(uint256 _newCommunityDonationRatio) external;
    function updateAgainstPeriods(uint256 _newAgainstPeriods) external;
    function updateTreasury(ITreasury _newTreasury) external;
    function updateStaking(IStaking _newStaking) external;
    function donate(IERC20 _token, uint256 _amount, address _delegateAddress) external;
    function donateToCommunity(ICommunity _community, IERC20 _token, uint256 _amount, address _delegateAddress) external;
    function lastPeriodsDonations(address _donor) external view returns (uint256, uint256);
    function claimRewards() external;
    function claimRewardsPartial(uint256 _lastPeriodNumber) external;
    function stakeRewards() external;
    function stakeRewardsPartial(uint256 _lastPeriodNumber) external;
    function calculateClaimableRewards(address _donor) external returns (uint256 claimAmount, uint256 lastDonorStakeAmount);
    function calculateClaimableRewardsByPeriodNumber(address _donor, uint256 _lastPeriodNumber) external returns (uint256 claimAmount, uint256 lastDonorStakeAmount);
    function estimateClaimableReward(address _donor) external view returns (uint256);
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function setStakingAmounts(address _holderAddress, uint256 _holderStakeAmount, uint256 _totalStakesAmount) external;
}
