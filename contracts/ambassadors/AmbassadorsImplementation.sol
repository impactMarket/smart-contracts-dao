// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/AmbassadorsStorageV1.sol";
import "../community/interfaces/ICommunityAdmin.sol";
import "hardhat/console.sol";

/**
 * @notice Welcome to Ambassadors contract.
 */
contract AmbassadorsImplementation is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    AmbassadorsStorageV1
{
    using EnumerableSet for EnumerableSet.AddressSet;

    event EntityAdded(address indexed entity);

    event EntityRemoved(address indexed entity);

    event AmbassadorAdded(address indexed ambassador, address indexed entity);

    event AmbassadorRemoved(address indexed ambassador);

    event AmbassadorReplaced(address indexed oldAmbassador, address indexed newAmbassador);

    event AmbassadorTransfered(address indexed ambassador, address indexed entity);

    event AmbassadorToCommunityUpdated(address indexed ambassador, address indexed community);

    event CommunityRemoved(address indexed community);

    modifier onlyAmbassador() {
        require(ambassadorByAddress[msg.sender] != 0, "Ambassador:: ONLY_AMBASSADOR");
        _;
    }

    modifier onlyEntity() {
        require(entityByAddress[msg.sender] != 0, "Ambassador:: ONLY_ENTITY");
        _;
    }

    modifier onlyEntityOrOwner() {
        require(
            entityByAddress[msg.sender] != 0 || owner() == msg.sender,
            "Ambassador:: ONLY_ENTITY_OR_OWNER"
        );
        _;
    }

    modifier onlyCommunityAdmin() {
        require(address(communityAdmin) == msg.sender, "Ambassador:: ONLY_COMMUNITY_ADMIN");
        _;
    }

    /**
     * @notice Used to initialize a new Ambassadors contract
     */
    function initialize(ICommunityAdmin _communityAdmin) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        ambassadorIndex = 1;
        entityIndex = 1;
        communityAdmin = _communityAdmin;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Is ambassador.
     */
    function isAmbassador(address _ambassador) public view override returns (bool) {
        return ambassadorByAddress[_ambassador] != 0;
    }

    /**
     * @notice Is ambassador of a given community.
     */
    function isAmbassadorOf(address _ambassador, address _community)
        public
        view
        override
        returns (bool)
    {
        return ambassadorByAddress[_ambassador] == communityToAmbassador[_community];
    }

    /**
     * @notice Is ambassador of a given community.
     */
    function isAmbassadorAt(address _ambassador, address _entityAddress)
        public
        view
        override
        returns (bool)
    {
        return ambassadorByAddress[_ambassador] == entityByAddress[_entityAddress];
    }

    /**
     * @notice Registers an entity.
     */
    function addEntity(address _entity) public override onlyOwner {
        require(entityByAddress[_entity] == 0, "Ambassador:: ALREADY_ENTITY");

        entityByAddress[_entity] = entityIndex;
        entityIndex++;

        emit EntityAdded(_entity);
    }

    /**
     * @notice Removes an entity.
     */
    function removeEntity(address _entity) public override onlyOwner {
        uint256 entityIndex = entityByAddress[_entity];

        require(entityIndex != 0, "Ambassador:: NOT_ENTITY");
        require(entityAmbassadors[entityIndex] == 0, "Ambassador:: HAS_AMBASSADORS");

        entityByAddress[_entity] = 0;

        emit EntityRemoved(_entity);
    }

    /**
     * @notice Registers an ambassador.
     */
    function addAmbassador(address _ambassador) external override onlyEntity {
        require(!isAmbassador(_ambassador), "Ambassador:: ALREADY_AMBASSADOR");

        uint256 entityIndex = entityByAddress[msg.sender];

        ambassadorByAddress[_ambassador] = ambassadorIndex;
        ambassadorByIndex[ambassadorIndex] = _ambassador;
        ambassadorToEntity[ambassadorIndex] = entityIndex;
        entityAmbassadors[entityIndex]++;
        ambassadorIndex++;

        emit AmbassadorAdded(_ambassador, msg.sender);
    }

    /**
     * @notice Removes an ambassador.
     */
    function removeAmbassador(address _ambassador) external override onlyEntity {
        uint256 ambassadorIndex = ambassadorByAddress[_ambassador];
        uint256 entityIndex = entityByAddress[msg.sender];

        require(isAmbassadorAt(_ambassador, msg.sender), "Ambassador:: NOT_AMBASSADOR");
        require(
            ambassadorCommunities[ambassadorIndex].length() == 0,
            "Ambassador:: HAS_COMMUNITIES"
        );

        entityAmbassadors[entityIndex]--;
        ambassadorByAddress[_ambassador] = 0;

        emit AmbassadorRemoved(_ambassador);
    }

    /**
     * @notice Replaces an ambassador.
     */
    function replaceAmbassador(address _oldAmbassador, address _newAmbassador)
        external
        override
        onlyEntityOrOwner
    {
        require(
            isAmbassadorAt(_oldAmbassador, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );
        require(!isAmbassador(_newAmbassador), "Ambassador:: ALREADY_AMBASSADOR");

        ambassadorByAddress[_newAmbassador] = ambassadorByAddress[_oldAmbassador];
        ambassadorByAddress[_oldAmbassador] = 0;

        emit AmbassadorReplaced(_oldAmbassador, _newAmbassador);
    }

    /**
     * @notice Transfers an ambassador.
     */
    function transferAmbassador(
        address _ambassador,
        address _toEntity,
        bool _keepCommunities
    ) external override onlyEntityOrOwner {
        require(
            isAmbassadorAt(_ambassador, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );
        require(
            ambassadorCommunities[ambassadorIndex].length() == 0 || _keepCommunities,
            "Ambassador:: HAS_COMMUNITIES"
        );

        uint256 ambassadorIndex = ambassadorByAddress[_ambassador];
        uint256 entityIndex = ambassadorToEntity[ambassadorIndex];
        uint256 entityToIndex = entityByAddress[_toEntity];

        ambassadorToEntity[ambassadorIndex] = entityToIndex;
        entityAmbassadors[entityIndex]--;
        entityAmbassadors[entityToIndex]++;

        emit AmbassadorTransfered(_ambassador, _toEntity);
    }

    /**
     * @notice Transfers community from ambassador to another ambassador.
     */
    function transferCommunityToAmbassador(address _to, address _community)
        external
        override
        onlyEntityOrOwner
    {
        address _from = ambassadorByIndex[communityToAmbassador[_community]];

        require(isAmbassadorOf(_from, _community), "Ambassador:: NOT_AMBASSADOR");
        require(!isAmbassadorOf(_to, _community), "Ambassador:: ALREADY_AMBASSADOR");
        require(
            isAmbassadorAt(_from, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );
        require(
            isAmbassadorAt(_to, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );

        communityToAmbassador[_community] = ambassadorByAddress[_to];
        ambassadorCommunities[ambassadorByAddress[_from]].remove(_community);
        ambassadorCommunities[ambassadorByAddress[_to]].add(_community);

        emit AmbassadorToCommunityUpdated(_from, _community);
    }

    /**
     * @notice Sets community to ambassador.
     */
    function setCommunityToAmbassador(address _ambassador, address _community)
        external
        override
        onlyCommunityAdmin
    {
        require(isAmbassador(_ambassador), "Ambassador:: NOT_AMBASSADOR");
        require(!isAmbassadorOf(_ambassador, _community), "Ambassador:: ALREADY_AMBASSADOR");

        uint256 ambassadorIndex = ambassadorByAddress[_ambassador];

        communityToAmbassador[_community] = ambassadorIndex;
        ambassadorCommunities[ambassadorIndex].add(_community);

        emit AmbassadorToCommunityUpdated(_ambassador, _community);
    }

    /**
     * @notice Removes community.
     */
    function removeCommunity(address _community) external override onlyCommunityAdmin {
        address _ambassador = ambassadorByIndex[communityToAmbassador[_community]];

        require(isAmbassadorOf(_ambassador, _community), "Ambassador:: NOT_AMBASSADOR");

        uint256 ambassadorIndex = ambassadorByAddress[_ambassador];

        communityToAmbassador[_community] = ambassadorIndex;
        ambassadorCommunities[ambassadorIndex].add(_community);

        emit CommunityRemoved(_community);
    }
}
