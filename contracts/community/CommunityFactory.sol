// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./Community.sol";
import "./interfaces/ICommunityAdmin.sol";

/**
 * @notice Welcome to CommunityFactory
 */
contract CommunityFactory {
    address public cUSDAddress;
    address public communityAdminAddress;

    constructor(address _cUSDAddress, address _communityAdminAddress) public {
        cUSDAddress = _cUSDAddress;
        communityAdminAddress = _communityAdminAddress;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == communityAdminAddress, "NOT_ALLOWED");
        _;
    }

    /**
     * @dev Add a new community. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function deployCommunity(
        address _firstManager,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        address _previousCommunityAddress
    ) external onlyCommunityAdmin returns (address) {
        return
            address(
                new Community(
                    _firstManager,
                    _claimAmount,
                    _maxClaim,
                    _baseInterval,
                    _incrementInterval,
                    _previousCommunityAddress,
                    cUSDAddress,
                    msg.sender
                )
            );
    }
}
