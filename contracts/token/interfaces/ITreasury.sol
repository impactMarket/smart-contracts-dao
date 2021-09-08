//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../community/interfaces/ICommunityAdmin.sol";

interface ITreasury {
    function cUSD() external view  returns(IERC20);
    function communityAdmin() external view returns(ICommunityAdmin);
//    function owner() external view returns (address);
//    function transferOwnership(address newOwner) external;

    function setCommunityAdmin(ICommunityAdmin communityAdmin) external;
    function transfer(IERC20 token, address to, uint256 amount) external;
}
