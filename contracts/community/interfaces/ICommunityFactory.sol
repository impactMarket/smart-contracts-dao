// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./ICommunity.sol";

interface ICommunityFactory {
    function deployCommunity(
        address firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval,
        ICommunity previousCommunity
    ) external returns(address);
    function communityAdmin() external view returns(address);
}
