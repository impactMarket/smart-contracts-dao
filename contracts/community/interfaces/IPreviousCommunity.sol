// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IPreviousCommunity {
    function getVersion() external pure returns(uint256);
    function claimAmount() external view returns(uint256);
    function cUSD() external view  returns(IERC20);
}
