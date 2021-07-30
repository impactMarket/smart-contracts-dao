// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityFactory.sol";
import "./Community.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdmin {
    address public admin;
    address public cUSDAddress;
    address public treasuryAddress;
    mapping(address => bool) public communities;
    address public communityFactory;

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
        address indexed _communityAddress,
        address indexed _previousCommunityAddress
    );
    event CommunityFactoryChanged(address indexed _newCommunityFactory);

    /**
     * @dev It sets the first admin, which later can add others
     * and add/remove communities.
     */
    constructor(
        address _cUSDAddress,
        address _admin,
        address _treasuryAddress
    ) public {
        cUSDAddress = _cUSDAddress;
        admin = _admin;
        treasuryAddress = _treasuryAddress;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "NOT_ADMIN");
        _;
    }

    modifier onlyCommunities() {
        require(communities[msg.sender] == true, "NOT_COMMUNITY");
        _;
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    function setTreasuryAddress(address _newTreasuryAddress) external onlyAdmin {
        treasuryAddress = _newTreasuryAddress;
    }

    /**
     * @dev Add a new community. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function addCommunity(
        address _firstManager,
        uint256 _claimAmount,
        uint256 _maxClaim,
        uint256 _baseInterval,
        uint256 _incrementInterval
    ) external onlyAdmin {
        address community = ICommunityFactory(communityFactory).deployCommunity(
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval,
            address(0)
        );
        require(community != address(0), "NOT_VALID");
        communities[community] = true;
        emit CommunityAdded(
            community,
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval
        );
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
    ) external onlyAdmin {
        communities[_previousCommunityAddress] = false;
        require(address(_previousCommunityAddress) != address(0), "NOT_VALID");
        ICommunity previousCommunity = ICommunity(_previousCommunityAddress);
        address community = ICommunityFactory(_newCommunityFactory).deployCommunity(
            _firstManager,
            previousCommunity.claimAmount(),
            previousCommunity.maxClaim(),
            previousCommunity.baseInterval(),
            previousCommunity.incrementInterval(),
            _previousCommunityAddress
        );
        require(community != address(0), "NOT_VALID");
        previousCommunity.migrateFunds(community, _firstManager);
        communities[community] = true;
        emit CommunityMigrated(_firstManager, community, _previousCommunityAddress);
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(address _community) external onlyAdmin {
        communities[_community] = false;
        emit CommunityRemoved(_community);
    }

    /**
     * @dev Set the community factory address, if the contract is valid.
     */
    function setCommunityFactory(address _communityFactory) external onlyAdmin {
        ICommunityFactory factory = ICommunityFactory(_communityFactory);
        require(factory.communityAdminAddress() == address(this), "NOT_ALLOWED");
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(_communityFactory);
    }

    /**
     * @dev Init community factory, used only at deploy time.
     */
    function initCommunityFactory(address _communityFactory) external onlyAdmin {
        require(communityFactory == address(0), "");
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(_communityFactory);
    }

    function fundCommunity() external onlyCommunities {
        ICommunity community = ICommunity(msg.sender);
        uint256 balance = IERC20(cUSDAddress).balanceOf(msg.sender);
        //        uint256 need = community.
        //        require ()
        console.log("fundCommunity");
    }
}
