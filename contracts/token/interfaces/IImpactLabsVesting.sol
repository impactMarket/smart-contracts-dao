//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "./ITreasury.sol";
import "./IDonationMiner.sol";

interface IImpactLabsVesting {
    function getVersion() external pure returns (uint256);
    function impactLabs() external view returns (address);
    function IPCT() external view returns (IERC20);
    function donationMiner() external view returns (IDonationMiner);
    function lastClaimedRewardPeriod() external view returns (uint256);
    function advancePayment() external view returns (uint256);
    function claim() external;
    function transfer(IERC20 token, address to, uint256 amount) external;
}
