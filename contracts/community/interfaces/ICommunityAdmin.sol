// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface ICommunityAdmin {
    function fundCommunity() external;
    function calculateCommunityTrancheAmount(address _community) external returns (uint256);
}





