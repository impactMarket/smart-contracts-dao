// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPreviousCommunity {
    function getVersion() external pure returns(uint256);
    function claimAmount() external view returns(uint256);
    function cUSD() external view  returns(IERC20);
}
