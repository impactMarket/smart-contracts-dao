//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "./ITreasury.sol";

interface IDonationMiner {
    struct RewardPeriod {
        uint256 rewardPerBlock; // Reward tokens created per block.
        uint256 rewardAmount; // Reward tokens from previous periods.
        uint256 startBlock; // The block number at which reward distribution starts.
        uint256 endBlock; // The block number at which reward distribution ends.
        uint256 donationsAmount; // Total of donations for this rewardPeriod.
        mapping(address => uint256) donations; // Amount donated by a donor in this rewardPeriod.
    }

    struct Donor {
        uint256 lastClaim;
        uint256 rewardPeriodsCount;
        mapping(uint256 => uint256) rewardPeriods;
    }

    function initialize(
        IERC20 cUSD,
        IERC20 IPCT,
        ITreasury treasury,
        uint256 firstRewardPerBlock,
        uint256 rewardPeriodSize,
        uint256 startingBlock,
        uint256 decay
    ) external;
    function cUSD() external view returns (IERC20);
    function IPCT() external view returns (IERC20);
    function treasury() external view returns (ITreasury);
    function rewardPeriodSize() external view returns (uint256);
    function startingBlock() external view returns (uint256);
    function decay() external view returns (uint256);
    function rewardPeriodCount() external view returns (uint256);
    function rewardPeriods(uint256 period) external view returns (
        uint256 rewardPerBlock,
        uint256 rewardAmount,
        uint256 startBlock,
        uint256 endBlock,
        uint256 donationsAmount
    );
    function rewardPeriodDonations(uint256 period, address donor) external view returns (uint256);
    function donors(address donor) external view returns (uint256 rewardPeriodsCount, uint256 lastClaim);
    function donations(address donor, uint256 donationId) external view returns (uint256 rewardPeriodNumber, uint256 amount);

    function setRewardPeriodSize(uint256 rewardPeriodSize) external;
    function setDecay(uint256 decay) external;
    function donate(uint256 amount) external;
    function donateToCommunity(ICommunity community, uint256 amount) external;
    function claimRewards() external;
    function calculateClaimableRewards(address donor) external returns (uint256);
    function estimateClaimableReward(address donor) external view returns (uint256);
    function transfer(IERC20 token, address to, uint256 amount) external;
}
