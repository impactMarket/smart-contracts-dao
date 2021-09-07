//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "./ITreasury.sol";

interface IDonationMiner {
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

//    function owner() external view returns (address);
//    function transferOwnership(address newOwner) external;
//    function cUSD() external view returns (IERC20);
//    function IPCT() external view returns (IERC20);
//    function treasury() external view returns (ITreasury);
//    function rewardPeriodSize() external view returns (uint256);
//    function startingBlock() external view returns (address);
//    function rewardPerBlock() external view returns (address);
//    function rewardPeriodCount() external view returns (uint256);
}
