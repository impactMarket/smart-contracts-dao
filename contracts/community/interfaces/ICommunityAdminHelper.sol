// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunity.sol";
import "./ICommunityAdmin.sol";

interface ICommunityAdminHelper {
    function communityAdmin() external view returns(ICommunityAdmin);
    function deployCommunity(
        address firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval,
        ICommunity previousCommunity
    ) external returns(address);
    function calculateCommunityTrancheAmount(ICommunity community) external view returns(uint256);
}
