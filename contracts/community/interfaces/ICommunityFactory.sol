// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./ICommunity.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICommunityAdmin.sol";

interface ICommunityFactory {
    function cUSD() external view returns(IERC20);
    function communityAdmin() external view returns(ICommunityAdmin);
    function deployCommunity(
        address firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval,
        ICommunity previousCommunity
    ) external returns(address);
}
