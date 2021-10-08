// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./Community.sol";
import "./CommunityAdminStorageV1.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdminImplementation is
    ICommunityAdmin,
    CommunityAdminStorageV1,
    Initializable,
    OwnableUpgradeable
{
    uint256 public constant VERSION = 1;

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

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
    event CommunityMinTrancheChanged(uint256 indexed _newCommunityMinTranche);
    event CommunityMaxTrancheChanged(uint256 indexed _newCommunitMaxTranche);

    modifier onlyCommunities() {
        require(_communities[msg.sender] == CommunityState.Valid, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    /**
     * @dev It sets the first admin, which later can add others
     * and add/remove communities.
     */
    function initialize(
        ICommunity communityTemplate_,
        IERC20 cUSD_,
        uint256 communityMinTranche_,
        uint256 communityMaxTranche_
    ) public override initializer {
        require(
            communityMinTranche_ < communityMaxTranche_,
            "CommunityAdmin::constructor: communityMinTranche should be less then communityMaxTranche"
        );

        __Ownable_init();

        _communityTemplate = communityTemplate_;
        _cUSD = cUSD_;
        _communityMinTranche = communityMinTranche_;
        _communityMaxTranche = communityMaxTranche_;

        _communityProxyAdmin = new ProxyAdmin();
    }

    function upgrade(address newImplementation) external onlyOwner {
        implementation = newImplementation;
    }

    function cUSD() external view override returns (IERC20) {
        return _cUSD;
    }

    function treasury() external view override returns (ITreasury) {
        return _treasury;
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
        address communityAddress = deployCommunity(
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
        ICommunityAdmin newCommunityAdminHelper_
    ) external override onlyOwner {
        _communities[address(previousCommunity_)] = CommunityState.Removed;
        require(
            address(previousCommunity_) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );
        ICommunity community = ICommunity(
            deployCommunity(
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

    function fundCommunity() external override onlyCommunities {
        require(
            _cUSD.balanceOf(msg.sender) <= _communityMinTranche,
            "CommunityAdmin::fundCommunity: this community has enough funds"
        );
        uint256 trancheAmount = calculateCommunityTrancheAmount(ICommunity(msg.sender));

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

    /**
     * @notice Update proxy implementation address
     *
     * @param _communityProxy Address of a wallet proxy
     * @param _newLogic Address of new implementation contract
     *
     */
    function updateProxyImplementation(address _communityProxy, address _newLogic)
        external
        override
        onlyOwner
    {
        _communityProxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(_communityProxy)),
            _newLogic
        );
    }

    function transferToCommunity(ICommunity community_, uint256 amount_) internal {
        _treasury.transfer(_cUSD, address(community_), amount_);
        community_.addTreasuryFunds(amount_);
    }

    function deployCommunity(
        address firstManager_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        ICommunity previousCommunity_
    ) internal onlyOwner returns (address) {
        TransparentUpgradeableProxy community = new TransparentUpgradeableProxy(
            address(_communityTemplate),
            address(_communityProxyAdmin),
            abi.encodeWithSignature(
                "initialize(address,uint256,uint256,uint256,uint256,address,address)",
                firstManager_,
                claimAmount_,
                maxClaim_,
                baseInterval_,
                incrementInterval_,
                address(previousCommunity_),
                address(this)
            )
        );

        return address(community);
    }

    function calculateCommunityTrancheAmount(ICommunity community_)
        internal
        view
        returns (uint256)
    {
        uint256 validBeneficiaries = community_.validBeneficiaryCount();
        uint256 claimAmount = community_.claimAmount();
        uint256 treasuryFunds = community_.treasuryFunds();
        uint256 privateFunds = community_.privateFunds();

        uint256 trancheAmount;
        trancheAmount =
            (10e36 * validBeneficiaries * (treasuryFunds + privateFunds)) /
            (claimAmount * treasuryFunds);

        if (trancheAmount < _communityMinTranche) {
            trancheAmount = _communityMinTranche;
        }

        if (trancheAmount > _communityMaxTranche) {
            trancheAmount = _communityMaxTranche;
        }

        return trancheAmount;
    }
}
