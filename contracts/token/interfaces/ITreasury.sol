//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITreasury {
    function admin() external;
    function setAdmin(address _newAdmin) external;
    function setCommunityAdmin(address _communityAdmin) external;
    function transferToCommunity(address _community, uint256 _amount) external;
}
