//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";

interface ITreasury {
    function getVersion() external returns(uint256);
    function communityAdmin() external view returns(ICommunityAdmin);
    function updateCommunityAdmin(ICommunityAdmin communityAdmin) external;
    function transfer(IERC20 token, address to, uint256 amount) external;
}
