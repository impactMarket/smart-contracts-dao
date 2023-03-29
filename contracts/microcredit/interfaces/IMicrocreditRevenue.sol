//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IMicrocreditRevenue {
    function getVersion() external returns (uint256);
    function transferERC20(IERC20 _token, address _to, uint256 _amount) external;
}
