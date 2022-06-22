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

    /**
     * @notice Triggered when an entity is added.
     *
     * @param entity Address of the entity added
     *
     */
    event EntityAdded(address indexed entity);

    /**
     * @notice Triggered when an entity is removed.
     *
     * @param entity Address of the entity removed
     *
     */
    event EntityRemoved(address indexed entity);

    /**
     * @notice Triggered when an entity replaced account address.
     *
     * @param entityIndex Entity index replacing account address
     * @param oldAccount Old account address
     * @param newAccount New account address
     *
     */
    event EntityAccountReplaced(
        uint256 entityIndex,
        address indexed oldAccount,
        address indexed newAccount
    );

    /**
     * @notice Triggered when an ambassador is added to an entity.
     *
     * @param ambassador Address of the ambassador added
     * @param entity Address of the entity where the ambassador is added
     *
     */
    event AmbassadorAdded(address indexed ambassador, address indexed entity);

    /**
     * @notice Triggered when an ambassador is removed.
     *
     * @param ambassador Address of the ambassador removed
     * @param entity Address of the entity where the ambassador is removed
     *
     */
    event AmbassadorRemoved(address indexed ambassador, address indexed entity);

    /**
     * @notice Triggered when an ambassador is replaced by the entity.
     *
     * @param ambassadorIndex Index of the ambassador being replaced
     * @param entityAccount Address of the entity where ambassador is being replaced
     * @param oldAmbassador Ambassador's old account address
     * @param newAmbassador Ambassador's new account address
     *
     */
    event AmbassadorReplaced(
        uint256 ambassadorIndex,
        address indexed entityAccount,
        address indexed oldAmbassador,
        address indexed newAmbassador
    );

    /**
     * @notice Triggered when an ambassador replaces it's own account.
     *
     * @param ambassadorIndex Index of the ambassador being replaced
     * @param entityAccount Address of the entity where ambassador is being replaced
     * @param oldAccount Ambassador's old account address
     * @param newAccount Ambassador's new account address
     *
     */
    event AmbassadorAccountReplaced(
        uint256 ambassadorIndex,
        address indexed entityAccount,
        address indexed oldAccount,
        address indexed newAccount
    );

    /**
     * @notice Triggered when an ambassador is transfered to a new entity.
     *
     * @param ambassador Ambassador address being replaced
     * @param oldEntity Entity's old account address
     * @param newEntity Entity's new account address
     *
     */
    event AmbassadorTransfered(
        address indexed ambassador,
        address indexed oldEntity,
        address indexed newEntity
    );

    /**
     * @notice Triggered when a community is transfered from one ambassador to another.
     *
     * @param fromAmbassador Ambassador address from which the community is being transfered from
     * @param toAmbassador Ambassador address to which the community is being transfered to
     * @param community Community address being transfered
     *
     */
    event AmbassadorToCommunityUpdated(
        address indexed fromAmbassador,
        address indexed toAmbassador,
        address indexed community
    );

    /**
     * @notice Triggered when a community is removed.
     *
     * @param ambassador Ambassador of the community being removed
     * @param community Community address being removed
     *
     */
    event CommunityRemoved(address indexed ambassador, address indexed community);

    /**
     * @notice Enforces sender to be an ambassador
     */
    modifier onlyAmbassador() {
        require(ambassadorByAddress[msg.sender] != 0, "Ambassador:: ONLY_AMBASSADOR");
        _;
    }

    /**
     * @notice Enforces sender to be an entity
     */
    modifier onlyEntity() {
        require(entityByAddress[msg.sender] != 0, "Ambassador:: ONLY_ENTITY");
        _;
    }

    /**
     * @notice Enforces sender to be an entity or owner
     */
    modifier onlyEntityOrOwner() {
        require(
            entityByAddress[msg.sender] != 0 || owner() == msg.sender,
            "Ambassador:: ONLY_ENTITY_OR_OWNER"
        );
        _;
    }

    /**
     * @notice Enforces sender to be te community admin contract
     */
    modifier onlyCommunityAdmin() {
        require(address(communityAdmin) == msg.sender, "Ambassador:: ONLY_COMMUNITY_ADMIN");
        _;
    }

    /**
     * @notice Used to initialize a new Ambassadors contract
     *
     * @param _communityAdmin Address of the community admin contract
     *
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
     * @notice Returns boolean whether an address is ambassador or not.
     *
     * @param _ambassador Address of the ambassador
     * @return Boolean whether an address is ambassador or not
     */
    function isAmbassador(address _ambassador) public view override returns (bool) {
        return ambassadorByAddress[_ambassador] != 0;
    }

    /**
     * @notice Returns boolean whether an address is ambassador of a given community.
     *
     * @param _ambassador Address of the ambassador
     * @param _community Address of the community
     * @return Boolean whether an address is ambassador of a given community or not
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
     * @notice Returns boolean whether an address is entity responsible for ambassador of a given community.
     *
     * @param _entity Address of the entity
     * @param _community Address of the community
     * @return Boolean whether an address is entity responsible for ambassador of a given community or not
     */
    function isEntityOf(address _entity, address _community) public view override returns (bool) {
        return entityByAddress[_entity] == ambassadorToEntity[communityToAmbassador[_community]];
    }

    /**
     * @notice Returns boolean whether an address is ambassador at a given entity.
     *
     * @param _ambassador Address of the ambassador
     * @param _entityAddress Address of the entity
     * @return Boolean whether an address is ambassador at a given entity or not
     */
    function isAmbassadorAt(address _ambassador, address _entityAddress)
        public
        view
        override
        returns (bool)
    {
        return
            ambassadorToEntity[ambassadorByAddress[_ambassador]] == entityByAddress[_entityAddress];
    }

    /** Updates the address of the communityAdmin
     *
     * @param _newCommunityAdmin address of the new communityAdmin
     * @dev used only for testing the new community upgrade flow
     */
    function updateCommunityAdmin(ICommunityAdmin _newCommunityAdmin) external onlyOwner {
        communityAdmin = _newCommunityAdmin;
    }

    /**
     * @notice Registers an entity.
     *
     * @param _entity Address of the entity
     */
    function addEntity(address _entity) public override onlyOwner {
        require(entityByAddress[_entity] == 0, "Ambassador:: ALREADY_ENTITY");

        entityByAddress[_entity] = entityIndex;
        entityByIndex[entityIndex] = _entity;
        entityIndex++;

        emit EntityAdded(_entity);
    }

    /**
     * @notice Removes an entity.
     *
     * @param _entity Address of the entity
     */
    function removeEntity(address _entity) public override onlyOwner {
        uint256 entityIndex = entityByAddress[_entity];

        require(entityIndex != 0, "Ambassador:: NOT_ENTITY");
        require(entityAmbassadors[entityIndex] == 0, "Ambassador:: HAS_AMBASSADORS");

        entityByIndex[entityIndex] = address(0);
        entityByAddress[_entity] = 0;

        emit EntityRemoved(_entity);
    }

    /**
     * @notice Replace entity account.
     *
     * @param _entity Address of the entity
     * @param _newEntity New entity address
     */
    function replaceEntityAccount(address _entity, address _newEntity) external override {
        uint256 entityIndex = entityByAddress[_entity];

        require(msg.sender == _entity || msg.sender == owner(), "Ambassador:: NOT_ALLOWED");
        require(entityIndex != 0, "Ambassador:: NOT_ENTITY");

        entityByIndex[entityIndex] = _newEntity;
        entityByAddress[_newEntity] = entityByAddress[_entity];
        entityByAddress[_entity] = 0;

        emit EntityAccountReplaced(entityIndex, _entity, _newEntity);
    }

    /**
     * @notice Registers an ambassador.
     *
     * @param _ambassador Address of the ambassador
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
     *
     * @param _ambassador Address of the ambassador
     */
    function removeAmbassador(address _ambassador) external override onlyEntity {
        uint256 thisAmbassadorIndex = ambassadorByAddress[_ambassador];
        uint256 entityIndex = entityByAddress[msg.sender];

        require(isAmbassadorAt(_ambassador, msg.sender), "Ambassador:: NOT_AMBASSADOR");
        require(
            ambassadorCommunities[thisAmbassadorIndex].length() == 0,
            "Ambassador:: HAS_COMMUNITIES"
        );

        entityAmbassadors[entityIndex]--;
        ambassadorByAddress[_ambassador] = 0;

        emit AmbassadorRemoved(_ambassador, msg.sender);
    }

    /**
     * @notice Replace ambassador account. Called by ambassador.
     *
     * @param _ambassador Address of the ambassador
     * @param _newAmbassador New ambassador address
     */
    function replaceAmbassadorAccount(address _ambassador, address _newAmbassador)
        external
        override
    {
        require(msg.sender == _ambassador || msg.sender == owner(), "Ambassador:: NOT_ALLOWED");
        require(isAmbassador(_ambassador), "Ambassador:: NOT_AMBASSADOR");
        require(!isAmbassador(_newAmbassador), "Ambassador:: ALREADY_AMBASSADOR");

        uint256 thisAmbassadorIndex;
        address entityAddress;
        address oldAmbassador;
        address newAmbassador;
        (
            thisAmbassadorIndex,
            entityAddress,
            oldAmbassador,
            newAmbassador
        ) = _replaceAmbassadorAccountInternal(_ambassador, _newAmbassador);

        emit AmbassadorAccountReplaced(
            thisAmbassadorIndex,
            entityAddress,
            oldAmbassador,
            newAmbassador
        );
    }

    /**
     * @notice Replaces an ambassador. Called by entity.
     *
     * @param _oldAmbassador Address of the ambassador
     * @param _newAmbassador New ambassador address
     */
    function replaceAmbassador(address _oldAmbassador, address _newAmbassador) external override {
        require(
            isAmbassadorAt(_oldAmbassador, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );
        require(!isAmbassador(_newAmbassador), "Ambassador:: ALREADY_AMBASSADOR");

        uint256 thisAmbassadorIndex;
        address entityAddress;
        address oldAmbassador;
        address newAmbassador;
        (
            thisAmbassadorIndex,
            entityAddress,
            oldAmbassador,
            newAmbassador
        ) = _replaceAmbassadorAccountInternal(_oldAmbassador, _newAmbassador);

        emit AmbassadorReplaced(thisAmbassadorIndex, entityAddress, oldAmbassador, newAmbassador);
    }

    /**
     * @notice Transfers an ambassador to another entity.
     *
     * @param _ambassador Address of the ambassador
     * @param _toEntity Address of the entity
     * @param _keepCommunities Boolean whether to keep the ambassador's communities or not
     */
    function transferAmbassador(
        address _ambassador,
        address _toEntity,
        bool _keepCommunities
    ) external override onlyEntityOrOwner {
        uint256 thisAmbassadorIndex = ambassadorByAddress[_ambassador];
        require(
            isAmbassadorAt(_ambassador, msg.sender) || msg.sender == owner(),
            "Ambassador:: NOT_AMBASSADOR"
        );
        require(
            ambassadorCommunities[thisAmbassadorIndex].length() == 0 || _keepCommunities == true,
            "Ambassador:: HAS_COMMUNITIES"
        );

        uint256 entityIndex = ambassadorToEntity[thisAmbassadorIndex];
        uint256 entityToIndex = entityByAddress[_toEntity];

        ambassadorToEntity[thisAmbassadorIndex] = entityToIndex;
        entityAmbassadors[entityIndex]--;
        entityAmbassadors[entityToIndex]++;

        emit AmbassadorTransfered(_ambassador, entityByIndex[entityIndex], _toEntity);
    }

    /**
     * @notice Transfers community from ambassador to another ambassador.
     *
     * @param _to Address of the ambassador to transfer the community to
     * @param _community Community address
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

        emit AmbassadorToCommunityUpdated(_from, _to, _community);
    }

    /**
     * @notice Sets community to ambassador.
     *
     * @param _ambassador Address of the ambassador
     * @param _community Community address
     */
    function setCommunityToAmbassador(address _ambassador, address _community)
        external
        override
        onlyCommunityAdmin
    {
        require(isAmbassador(_ambassador), "Ambassador:: NOT_AMBASSADOR");
        require(!isAmbassadorOf(_ambassador, _community), "Ambassador:: ALREADY_AMBASSADOR");

        uint256 thisAmbassadorIndex = ambassadorByAddress[_ambassador];

        communityToAmbassador[_community] = thisAmbassadorIndex;
        ambassadorCommunities[thisAmbassadorIndex].add(_community);

        emit AmbassadorToCommunityUpdated(address(0), _ambassador, _community);
    }

    /**
     * @notice Removes community.
     *
     * @param _community Community address
     */
    function removeCommunity(address _community) external override onlyCommunityAdmin {
        address _ambassador = ambassadorByIndex[communityToAmbassador[_community]];

        require(isAmbassadorOf(_ambassador, _community), "Ambassador:: NOT_AMBASSADOR");

        uint256 thisAmbassadorIndex = ambassadorByAddress[_ambassador];

        communityToAmbassador[_community] = 0;
        ambassadorCommunities[thisAmbassadorIndex].remove(_community);

        emit CommunityRemoved(_ambassador, _community);
    }

    /**
     * @notice Internal function, common to account replacement.
     *
     * @param _old Address of the ambassador
     * @param _new New ambassador address
     */
    function _replaceAmbassadorAccountInternal(address _old, address _new)
        private
        returns (
            uint256,
            address,
            address,
            address
        )
    {
        uint256 thisAmbassadorIndex = ambassadorByAddress[_old];
        uint256 entityIndex = ambassadorToEntity[thisAmbassadorIndex];

        ambassadorByIndex[thisAmbassadorIndex] = _new;
        ambassadorByAddress[_new] = ambassadorByAddress[_old];
        ambassadorByAddress[_old] = 0;

        return (thisAmbassadorIndex, entityByIndex[entityIndex], _old, _new);
    }
}
