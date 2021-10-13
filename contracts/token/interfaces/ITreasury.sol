//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";

interface ITreasury {
    function initialize(ICommunityAdmin communityAdmin) external;
    function communityAdmin() external view returns(ICommunityAdmin);
    function setCommunityAdmin(ICommunityAdmin communityAdmin) external;
    function transfer(IERC20 token, address to, uint256 amount) external;
}
