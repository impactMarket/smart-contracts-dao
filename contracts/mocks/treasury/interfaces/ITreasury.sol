//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../community/interfaces/ICommunityAdmin.sol";

interface ITreasury {
    function getVersion() external pure returns(uint256);
    function communityAdmin() external view returns(ICommunityAdmin);
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
}
