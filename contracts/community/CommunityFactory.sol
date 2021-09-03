// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Community.sol";
import "./interfaces/ICommunityAdmin.sol";

/**
 * @notice Welcome to CommunityFactory
 */
contract CommunityFactory {
    IERC20 public cUSD;
    ICommunityAdmin public communityAdmin;

    constructor(IERC20 _cUSD, ICommunityAdmin _communityAdmin) public {
        cUSD = _cUSD;
        communityAdmin = _communityAdmin;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == address(communityAdmin), "NOT_ALLOWED");
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
        ICommunity _previousCommunity
    ) external onlyCommunityAdmin returns (address) {
        return
            address(
                new Community(
                    _firstManager,
                    _claimAmount,
                    _maxClaim,
                    _baseInterval,
                    _incrementInterval,
                    _previousCommunity,
                    cUSD,
                    ICommunityAdmin(msg.sender)
                )
            );
    }
}
