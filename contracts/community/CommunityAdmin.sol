// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityAdminHelper.sol";
import "./Community.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdmin is ICommunityAdmin, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant VERSION = 1;

    IERC20 private _cUSD;
    ITreasury private _treasury;
    ICommunityAdminHelper private _communityAdminHelper;
    uint256 private _communityMinTranche;
    uint256 private _communityMaxTranche;

    mapping(address => CommunityState) private _communities;
    EnumerableSet.AddressSet private _communityList;

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
    event CommunityAdminHelperChanged(address indexed _newCommunityAdminHelper);
    event CommunityMinTrancheChanged(uint256 indexed _newCommunityMinTranche);
    event CommunityMaxTrancheChanged(uint256 indexed _newCommunitMaxTranche);

    /**
     * @dev It sets the first admin, which later can add others
     * and add/remove communities.
     */
    constructor(
        IERC20 cUSD_,
        uint256 communityMinTranche_,
        uint256 communityMaxTranche_
    ) {
        require(
            communityMinTranche_ < communityMaxTranche_,
            "CommunityAdmin::constructor: communityMinTranche should be less then communityMaxTranche"
        );
        _cUSD = cUSD_;
        _communityMinTranche = communityMinTranche_;
        _communityMaxTranche = communityMaxTranche_;
    }

    modifier onlyCommunities() {
        require(_communities[msg.sender] == CommunityState.Valid, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    function cUSD() external view override returns (IERC20) {
        return _cUSD;
    }

    function treasury() external view override returns (ITreasury) {
        return _treasury;
    }

    function communityAdminHelper() external view override returns (ICommunityAdminHelper) {
        return _communityAdminHelper;
    }

    function communities(address communityAddress_)
        external
        view
        override
        returns (CommunityState)
    {
        return _communities[communityAddress_];
    }

    function communityMinTranche() external view override returns (uint256) {
        return _communityMinTranche;
    }

    function communityMaxTranche() external view override returns (uint256) {
        return _communityMaxTranche;
    }

    function communityList(uint256 index) external view override returns (address) {
        return _communityList.at(index);
    }

    function communityListLength() external view override returns (uint256) {
        return _communityList.length();
    }

    function setTreasury(ITreasury newTreasury_) external override onlyOwner {
        _treasury = newTreasury_;
    }

    /**
     * @dev Set the community min tranche
     */
    function setCommunityMinTranche(uint256 newCommunityMinTranche_) external override onlyOwner {
        require(
            newCommunityMinTranche_ < _communityMaxTranche,
            "CommunityAdmin::setCommunityMinTranche: New communityMinTranche should be less then communityMaxTranche"
        );
        _communityMinTranche = newCommunityMinTranche_;
        emit CommunityMinTrancheChanged(newCommunityMinTranche_);
    }

    /**
     * @dev Set the community max tranche
     */
    function setCommunityMaxTranche(uint256 newCommunityMaxTranche_) external override onlyOwner {
        require(
            _communityMinTranche < newCommunityMaxTranche_,
            "CommunityAdmin::setCommunityMaxTranche: New communityMaxTranche should be greater then communityMinTranche"
        );
        _communityMaxTranche = newCommunityMaxTranche_;
        emit CommunityMaxTrancheChanged(newCommunityMaxTranche_);
    }

    /**
     * @dev Add a new community. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function addCommunity(
        address firstManager_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 baseInterval_,
        uint256 incrementInterval_
    ) external override onlyOwner {
        address communityAddress = _communityAdminHelper.deployCommunity(
            firstManager_,
            claimAmount_,
            maxClaim_,
            baseInterval_,
            incrementInterval_,
            ICommunity(address(0))
        );
        require(communityAddress != address(0), "CommunityAdmin::addCommunity: NOT_VALID");
        _communities[communityAddress] = CommunityState.Valid;
        _communityList.add(communityAddress);
        emit CommunityAdded(
            communityAddress,
            firstManager_,
            claimAmount_,
            maxClaim_,
            baseInterval_,
            incrementInterval_
        );

        transferToCommunity(ICommunity(communityAddress), _communityMinTranche);
    }

    /**
     * @dev Migrate community by deploying a new contract. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function migrateCommunity(
        address firstManager_,
        ICommunity previousCommunity_,
        ICommunityAdminHelper newCommunityAdminHelper_
    ) external override onlyOwner {
        _communities[address(previousCommunity_)] = CommunityState.Removed;
        require(
            address(previousCommunity_) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );
        ICommunity community = ICommunity(
            newCommunityAdminHelper_.deployCommunity(
                firstManager_,
                previousCommunity_.claimAmount(),
                previousCommunity_.maxClaim(),
                previousCommunity_.baseInterval(),
                previousCommunity_.incrementInterval(),
                previousCommunity_
            )
        );
        require(address(community) != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");
        previousCommunity_.migrateFunds(community, firstManager_);
        _communities[address(community)] = CommunityState.Valid;
        _communityList.add(address(community));

        emit CommunityMigrated(firstManager_, address(community), address(previousCommunity_));
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(ICommunity community_) external override onlyOwner {
        _communities[address(community_)] = CommunityState.Removed;
        emit CommunityRemoved(address(community_));
    }

    /**
     * @dev Set the community factory address, if the contract is valid.
     */
    function setCommunityAdminHelper(ICommunityAdminHelper communityAdminHelper_)
        external
        override
        onlyOwner
    {
        require(
            address(communityAdminHelper_.communityAdmin()) == address(this),
            "CommunityAdmin::setCommunityAdminHelper: NOT_ALLOWED"
        );
        _communityAdminHelper = communityAdminHelper_;
        emit CommunityAdminHelperChanged(address(communityAdminHelper_));
    }

    /**
     * @dev Init community factory, used only at deploy time.
     */
    function initCommunityAdminHelper(ICommunityAdminHelper communityAdminHelper_)
        external
        override
        onlyOwner
    {
        require(
            address(communityAdminHelper_) == address(0),
            "CommunityAdmin::initCommunityAdminHelper: NOT_VALID"
        );
        _communityAdminHelper = communityAdminHelper_;
        emit CommunityAdminHelperChanged(address(communityAdminHelper_));
    }

    function fundCommunity() external override onlyCommunities {
        require(
            _cUSD.balanceOf(msg.sender) <= _communityMinTranche,
            "CommunityAdmin::fundCommunity: this community has enough funds"
        );
        uint256 trancheAmount = _communityAdminHelper.calculateCommunityTrancheAmount(
            ICommunity(msg.sender)
        );

        transferToCommunity(ICommunity(msg.sender), trancheAmount);
    }

    function transfer(
        IERC20 erc20_,
        address to_,
        uint256 amount_
    ) external override onlyOwner {
        erc20_.safeTransfer(to_, amount_);
    }

    function transferFromCommunity(
        ICommunity community_,
        IERC20 erc20_,
        address to_,
        uint256 amount_
    ) external override onlyOwner {
        community_.transferFunds(erc20_, to_, amount_);
    }

    function transferToCommunity(ICommunity community_, uint256 amount_) internal {
        _treasury.transfer(_cUSD, address(community_), amount_);
        community_.addTreasuryFunds(amount_);
    }
}
