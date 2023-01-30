// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

/**
 * A token that cannot be transferred.
 */
interface INonTransferrableToken {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    // Views
    function totalSupply() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);
}
