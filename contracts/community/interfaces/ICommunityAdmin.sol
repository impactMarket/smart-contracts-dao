// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface ICommunityAdmin {
    function fundCommunity() external;
    function calculateCommunityTrancheAmount(ICommunity community) external returns (uint256);
    function transferFunds(IERC20 token, address to, uint256 amount) external;
}





