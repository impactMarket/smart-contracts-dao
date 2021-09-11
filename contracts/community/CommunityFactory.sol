// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Community.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./interfaces/ICommunityFactory.sol";

/**
 * @notice Welcome to CommunityFactory
 */
contract CommunityFactory is ICommunityFactory, Ownable {
    ICommunityAdmin private _communityAdmin;

    constructor(ICommunityAdmin communityAdmin_) {
        _communityAdmin = communityAdmin_;
        transferOwnership(address(communityAdmin_));
    }

    function communityAdmin() external view override returns (ICommunityAdmin) {
        return _communityAdmin;
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
        ICommunity _previousCommunity
    ) external override onlyOwner returns (address) {
        return
            address(
                new Community(
                    _firstManager,
                    _claimAmount,
                    _maxClaim,
                    _baseInterval,
                    _incrementInterval,
                    _previousCommunity,
                    ICommunityAdmin(msg.sender)
                )
            );
    }
}
