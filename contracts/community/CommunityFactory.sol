// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Community.sol";
import "./interfaces/ICommunityAdmin.sol";
import "./interfaces/ICommunityFactory.sol";

/**
 * @notice Welcome to CommunityFactory
 */
contract CommunityFactory is ICommunityFactory {
    IERC20 private _cUSD;
    ICommunityAdmin private _communityAdmin;

    constructor(IERC20 cUSD_, ICommunityAdmin communityAdmin_) {
        _cUSD = cUSD_;
        _communityAdmin = communityAdmin_;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == address(_communityAdmin), "NOT_ALLOWED");
        _;
    }

    function cUSD() external view override returns (IERC20) {
        return _cUSD;
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
    ) external override onlyCommunityAdmin returns (address) {
        return
            address(
                new Community(
                    _firstManager,
                    _claimAmount,
                    _maxClaim,
                    _baseInterval,
                    _incrementInterval,
                    _previousCommunity,
                    _cUSD,
                    ICommunityAdmin(msg.sender)
                )
            );
    }
}
