// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./Community.sol";
import "./interfaces/ICommunity.sol";

/**
 * @notice Welcome to CommunityFactory
 */
contract CommunityFactory {
    address public cUSDAddress;
    address public impactMarketAddress;
    mapping(address => bool) public communities;

    event CommunityAdded(
        address indexed _communityAddress,
        address indexed _firstManager,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _baseInterval,
        uint256 _incrementInterval
    );
    event CommunityRemoved(address indexed _communityAddress);
    event CommunityMigrated(
        address indexed _firstManager,
        address indexed CommunityMigrated,
        address indexed _previousCommunityAddress
    );

    constructor(address _cUSDAddress, address _impactMarketAddress) {
        cUSDAddress = _cUSDAddress;
        impactMarketAddress = _impactMarketAddress;
    }

    modifier onlyImpactMarket() {
        require(msg.sender == impactMarketAddress, "NOT_ALLOWED");
        _;
    }

    /**
     * @dev Add a new community. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function createCommunity(
        address _firstManager,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) public onlyImpactMarket returns (address) {
        address community = _deployCommunity(
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval,
            address(0)
        );

        communities[community] = true;
        emit CommunityAdded(
            community,
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval
        );

        return community;
    }

    /**
     * @dev Migrate community by deploying a new contract. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function migrateCommunity(
        address _firstManager,
        address _previousCommunityAddress,
        address _newCommunityFactory
    )
    external
    onlyImpactMarket
    {
        communities[_previousCommunityAddress] = false;
        require(address(_previousCommunityAddress) != address(0), "NOT_VALID");
        ICommunity previousCommunity = ICommunity(_previousCommunityAddress);

    address community = _deployCommunity(
            _firstManager,
            previousCommunity.claimAmount(),
            previousCommunity.maxClaim(),
            previousCommunity.baseInterval(),
            previousCommunity.incrementInterval(),
            _previousCommunityAddress
        );

        previousCommunity.migrateFunds(community, _firstManager);

        communities[community] = true;

        emit CommunityMigrated(_firstManager, community, _previousCommunityAddress);
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(address _community) external onlyImpactMarket
    {
        communities[_community] = false;
        emit CommunityRemoved(_community);
    }

    function _deployCommunity(
        address _firstManager,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _baseInterval,
        uint256 _incrementInterval,
        address _previousCommunityAddress) internal returns (address) {

        address community = address(
            new Community(
                _firstManager,
                _claimAmount,
                _maxClaim,
                _baseInterval,
                _incrementInterval,
                _previousCommunityAddress,
                cUSDAddress,
                address(this)
            )
        );
        require(community != address(0), "NOT_VALID");

        return community;
    }
}
