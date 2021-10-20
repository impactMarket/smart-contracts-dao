// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/CommunityAdminStorageV1.sol";
import "./Community.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdminImplementation is
    CommunityAdminStorageV1,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    uint256 public constant VERSION = 1;

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Triggered when a community has been added
     *
     * @param communityAddress  Address of the community that has been added
     * @param firstManager      Address of the first manager
     * @param claimAmount       Value of the claimAmount
     * @param maxClaim          Value of the maxClaim
     * @param baseInterval      Value of the baseInterval
     * @param incrementInterval Value of the incrementInterval
     *
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    event CommunityAdded(
        address indexed communityAddress,
        address indexed firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 baseInterval,
        uint256 incrementInterval
    );

    /**
     * @notice Triggered when a community has been removed
     *
     * @param communityAddress  Address of the community that has been removed
     */
    event CommunityRemoved(address indexed communityAddress);

    /**
     * @notice Triggered when a community has been migrated
     *
     * @param firstManager             Address of the new community's first manager
     * @param communityAddress         New community address
     * @param previousCommunityAddress Old community address
     */
    event CommunityMigrated(
        address indexed firstManager,
        address indexed communityAddress,
        address indexed previousCommunityAddress
    );

    /**
     * @notice Triggered when the tranche limits have been changed
     *
     * @param oldCommunityMinTranche  Old communityMinTranche value
     * @param oldCommunityMaxTranche  Old communityMaxTranche value
     * @param newCommunityMinTranche  New communityMinTranche value
     * @param newCommunityMaxTranche  New communityMaxTranche value
     *
     * For further information regarding each parameter, see
     * *CommunityAdminImplementation* smart contract initialize method.
     */
    event CommunityTrancheLimitsChanged(
        uint256 oldCommunityMinTranche,
        uint256 oldCommunityMaxTranche,
        uint256 newCommunityMinTranche,
        uint256 newCommunityMaxTranche
    );

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    modifier onlyCommunities() {
        require(_communities[msg.sender] == CommunityState.Valid, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

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

    function setCommunityTemplate(ICommunity communityTemplate_) external override onlyOwner {
        _communityTemplate = communityTemplate_;
    }

    /**
     * @dev Edit community tranche limits
     */
    function editCommunityTrancheLimits(
        uint256 newCommunityMinTranche_,
        uint256 newCommunityMaxTranche_
    ) external override onlyOwner {
        require(
            newCommunityMinTranche_ < newCommunityMaxTranche_,
            "CommunityAdmin::editCommunityTrancheLimits: communityMinTranche should be less than communityMaxTranche"
        );

        uint256 oldCommunityMinTranche = _communityMinTranche;
        uint256 oldCommunityMaxTranche = _communityMaxTranche;

        _communityMinTranche = newCommunityMinTranche_;
        _communityMaxTranche = newCommunityMaxTranche_;

        emit CommunityTrancheLimitsChanged(
            oldCommunityMinTranche,
            oldCommunityMaxTranche,
            newCommunityMinTranche_,
            newCommunityMaxTranche_
        );
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
    ) external override onlyOwner returns (address) {
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

        return communityAddress;
    }

    /**
     * @dev Migrate community by deploying a new contract. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    function migrateCommunity(address firstManager_, ICommunity previousCommunity_)
        external
        override
        onlyOwner
        nonReentrant
    {
        _communities[address(previousCommunity_)] = CommunityState.Removed;
        require(
            address(previousCommunity_) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );

        uint256 maxClaim = previousCommunity_.impactMarketAddress() == address(0)
            ? previousCommunity_.maxClaim() +
                previousCommunity_.validBeneficiaryCount() *
                previousCommunity_.decreaseStep()
            : previousCommunity_.maxClaim();
        ICommunity community = ICommunity(
            deployCommunity(
                firstManager_,
                previousCommunity_.claimAmount(),
                maxClaim,
                previousCommunity_.baseInterval(),
                previousCommunity_.incrementInterval(),
                previousCommunity_
            )
        );
        require(address(community) != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");

        if (previousCommunity_.impactMarketAddress() == address(0)) {
            uint256 balance = _cUSD.balanceOf(address(previousCommunity_));
            previousCommunity_.transfer(_cUSD, address(community), balance);
        }

        _communities[address(community)] = CommunityState.Valid;
        _communityList.add(address(community));

        emit CommunityMigrated(firstManager_, address(community), address(previousCommunity_));
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(ICommunity community_) external override onlyOwner nonReentrant {
        _communities[address(community_)] = CommunityState.Removed;
        emit CommunityRemoved(address(community_));

        community_.transfer(_cUSD, address(_treasury), _cUSD.balanceOf(address(community_)));
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
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }

    function transferFromCommunity(
        ICommunity community_,
        IERC20 erc20_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        community_.transfer(erc20_, to_, amount_);
    }

    function editCommunity(
        ICommunity community_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_
    ) external override onlyOwner {
        community_.edit(claimAmount_, maxClaim_, decreaseStep_, baseInterval_, incrementInterval_);
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

    function transferToCommunity(ICommunity community_, uint256 amount_) internal nonReentrant {
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
                "initialize(address,uint256,uint256,uint256,uint256,address)",
                firstManager_,
                claimAmount_,
                maxClaim_,
                baseInterval_,
                incrementInterval_,
                address(previousCommunity_)
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
            (1e36 * validBeneficiaries * (treasuryFunds + privateFunds)) /
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
