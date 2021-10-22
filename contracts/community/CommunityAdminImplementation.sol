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
     * @param decreaseStep      Value of the decreaseStep
     * @param baseInterval      Value of the baseInterval
     * @param incrementInterval Value of the incrementInterval
     * @param minTranche        Value of the minTranche
     * @param maxTranche        Value of the maxTranche
     *
     * For further information regarding each parameter, see
     * *Community* smart contract initialize method.
     */
    event CommunityAdded(
        address indexed communityAddress,
        address indexed firstManager,
        uint256 claimAmount,
        uint256 maxClaim,
        uint256 decreaseStep,
        uint256 baseInterval,
        uint256 incrementInterval,
        uint256 minTranche,
        uint256 maxTranche
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
     * @notice Triggered when the treasury address has been updated
     *
     * @param oldTreasury             Old treasury address
     * @param newTreasury             New treasury address
     */
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Triggered when the communityTemplate address has been updated
     *
     * @param oldCommunityTemplate    Old communityTemplate address
     * @param newCommunityTemplate    New communityTemplate address
     */
    event CommunityTemplateUpdated(
        address indexed oldCommunityTemplate,
        address indexed newCommunityTemplate
    );

    /**
     * @notice Triggered when a community has been funded
     *
     * @param community           Address of the community
     * @param amount              Amount of the funding
     */
    event CommunityFunded(address indexed community, uint256 amount);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Enforces sender to be a valid community
     */
    modifier onlyCommunities() {
        require(_communities[msg.sender] == CommunityState.Valid, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    /**
     * @notice Used to initialize a new CommunityAdmin contract
     *
     * @param communityTemplate_    Address of the Community implementation
     *                              used for deploying new communities
     * @param cUSD_                 Address of the cUSD token
     */
    function initialize(ICommunity communityTemplate_, IERC20 cUSD_) external override initializer {
        __Ownable_init();

        _communityTemplate = communityTemplate_;
        _cUSD = cUSD_;

        _communityProxyAdmin = new ProxyAdmin();
    }

    /**
     * @notice Returns the cUsd contract address
     */
    function cUSD() external view override returns (IERC20) {
        return _cUSD;
    }

    /**
     * @notice Returns the CommunityAdmin contract address
     */
    function treasury() external view override returns (ITreasury) {
        return _treasury;
    }

    /**
     * @notice Returns the state of a community
     *
     * @param communityAddress_ address of the community
     */
    function communities(address communityAddress_)
        external
        view
        override
        returns (CommunityState)
    {
        return _communities[communityAddress_];
    }

    /**
     * @notice Returns the address of a community from _communityList
     *
     * @param index index of the community
     * @return address of the community
     */
    function communityList(uint256 index) external view override returns (address) {
        return _communityList.at(index);
    }

    /**
     * @notice Returns the number of communities
     *
     * @return uint256 number of communities
     */
    function communityListLength() external view override returns (uint256) {
        return _communityList.length();
    }

    /**
     * @notice Updates the address of the treasury
     *
     * @param newTreasury_ address of the new treasury contract
     */
    function updateTreasury(ITreasury newTreasury_) external override onlyOwner {
        address oldTreasuryAddress = address(_treasury);
        _treasury = newTreasury_;

        emit TreasuryUpdated(oldTreasuryAddress, address(_treasury));
    }

    /**
     * @notice Updates the address of the the communityTemplate
     *
     * @param newCommunityTemplate address of the new communityTemplate contract
     */
    function updateCommunityTemplate(ICommunity newCommunityTemplate) external override onlyOwner {
        address oldCommunityTemplateAddress = address(newCommunityTemplate);
        _communityTemplate = newCommunityTemplate;

        emit CommunityTemplateUpdated(oldCommunityTemplateAddress, address(newCommunityTemplate));
    }

    /**
     * @notice Adds a new community
     *
     * @param firstManager_ address of the community first manager. Will be able to add others
     * @param claimAmount_ base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim at in total
     * @param decreaseStep_ value decreased from maxClaim for every beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     * @param managerBlockList_    Addresses of managers that have to not be managers
     */
    function addCommunity(
        address firstManager_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        uint256 minTranche_,
        uint256 maxTranche_,
        address[] memory managerBlockList_
    ) external override onlyOwner {
        address communityAddress = deployCommunity(
            firstManager_,
            claimAmount_,
            maxClaim_,
            decreaseStep_,
            baseInterval_,
            incrementInterval_,
            minTranche_,
            maxTranche_,
            ICommunity(address(0)),
            managerBlockList_
        );
        require(communityAddress != address(0), "CommunityAdmin::addCommunity: NOT_VALID");
        _communities[communityAddress] = CommunityState.Valid;
        _communityList.add(communityAddress);

        emit CommunityAdded(
            communityAddress,
            firstManager_,
            claimAmount_,
            maxClaim_,
            decreaseStep_,
            baseInterval_,
            incrementInterval_,
            minTranche_,
            maxTranche_
        );

        transferToCommunity(ICommunity(communityAddress), minTranche_);
    }

    /**
     * @notice Migrates a community by deploying a new contract.
     *
     * @param firstManager_ address of the community first manager. Will be able to add others
     * @param previousCommunity_ address of the community to be migrated
     * @param managerBlockList_    Addresses of managers that have to not be managers
     */
    function migrateCommunity(
        address firstManager_,
        ICommunity previousCommunity_,
        address[] memory managerBlockList_
    ) external override onlyOwner nonReentrant {
        _communities[address(previousCommunity_)] = CommunityState.Removed;
        require(
            address(previousCommunity_) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );

        uint256 maxClaim = isCommunityNewType(previousCommunity_)
            ? previousCommunity_.getInitialMaxClaim()
            : previousCommunity_.maxClaim();

        ICommunity community = ICommunity(
            deployCommunity(
                firstManager_,
                previousCommunity_.claimAmount(),
                maxClaim,
                previousCommunity_.decreaseStep(),
                previousCommunity_.baseInterval(),
                previousCommunity_.incrementInterval(),
                previousCommunity_.minTranche(),
                previousCommunity_.maxTranche(),
                previousCommunity_,
                managerBlockList_
            )
        );
        require(address(community) != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");

        if (isCommunityNewType(previousCommunity_)) {
            uint256 balance = _cUSD.balanceOf(address(previousCommunity_));
            previousCommunity_.transfer(_cUSD, address(community), balance);
        }

        _communities[address(community)] = CommunityState.Valid;
        _communityList.add(address(community));

        emit CommunityMigrated(firstManager_, address(community), address(previousCommunity_));
    }

    /**
     * @notice Adds addresses to community managerBlockList
     *
     * @param community_ address of the community
     * @param managerBlockList_ addresses to be added in community managerBlockList
     */
    function addManagersToCommunityBlockList(
        ICommunity community_,
        address[] memory managerBlockList_
    ) external override onlyOwner {
        community_.addManagersToBlockList(managerBlockList_);
    }

    /**
     * @notice Removes addresses from community managerBlockList
     *
     * @param community_ address of the community
     * @param managerAllowList_ addresses to be removed from community managerBlockList
     */
    function removeManagersFromCommunityBlockList(
        ICommunity community_,
        address[] memory managerAllowList_
    ) external override onlyOwner {
        community_.removeManagersFromBlockList(managerAllowList_);
    }

    /**
     * @notice Adds a new manager to a community
     *
     * @param community_ address of the community
     * @param account_ address to be added as community manager
     */
    function addManagerToCommunity(ICommunity community_, address account_)
        external
        override
        onlyOwner
    {
        community_.addManager(account_);
    }

    /**
     * @notice Removes an existing community. All community funds are transferred to the treasury
     *
     * @param community_ address of the community
     */
    function removeCommunity(ICommunity community_) external override onlyOwner nonReentrant {
        _communities[address(community_)] = CommunityState.Removed;
        emit CommunityRemoved(address(community_));
        community_.transfer(_cUSD, address(_treasury), _cUSD.balanceOf(address(community_)));
    }

    /**
     * @dev Funds an existing community if it hasn't enough funds
     */
    function fundCommunity() external override onlyCommunities {
        require(
            _cUSD.balanceOf(msg.sender) <= ICommunity(msg.sender).minTranche(),
            "CommunityAdmin::fundCommunity: this community has enough funds"
        );
        uint256 trancheAmount = calculateCommunityTrancheAmount(ICommunity(msg.sender));

        transferToCommunity(ICommunity(msg.sender), trancheAmount);
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param token_ address of the ERC20 token
     * @param to_ address of the receiver
     * @param amount_ amount of the transaction
     */
    function transfer(
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }

    /**
     * @notice Transfers an amount of an ERC20 from  community to an address
     *
     * @param community_ address of the community
     * @param token_ address of the ERC20 token
     * @param to_ address of the receiver
     * @param amount_ amount of the transaction
     */
    function transferFromCommunity(
        ICommunity community_,
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        community_.transfer(token_, to_, amount_);
    }

    /** @notice Updates the beneficiary params of a community
     *
     * @param community_ address of the community
     * @param claimAmount_  base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim  in total
     * @param decreaseStep_ value decreased from maxClaim each time a is beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     */
    function updateBeneficiaryParams(
        ICommunity community_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_
    ) external override onlyOwner {
        community_.updateBeneficiaryParams(
            claimAmount_,
            maxClaim_,
            decreaseStep_,
            baseInterval_,
            incrementInterval_
        );
    }

    /** @notice Updates params of a community
     *
     * @param community_ address of the community
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     */
    function updateCommunityParams(
        ICommunity community_,
        uint256 minTranche_,
        uint256 maxTranche_
    ) external override onlyOwner {
        community_.updateCommunityParams(minTranche_, maxTranche_);
    }

    /**
     * @notice Updates proxy implementation address of a community
     *
     * @param communityProxy_ address of the community
     * @param newCommunityTemplate_ address of new implementation contract
     */
    function updateProxyImplementation(address communityProxy_, address newCommunityTemplate_)
        external
        override
        onlyOwner
    {
        _communityProxyAdmin.upgrade(
            TransparentUpgradeableProxy(payable(communityProxy_)),
            newCommunityTemplate_
        );
    }

    /**
     * @dev Transfers cUSDs from the treasury to a community
     *
     * @param community_ address of the community
     * @param amount_ amount of the transaction
     */
    function transferToCommunity(ICommunity community_, uint256 amount_) internal nonReentrant {
        _treasury.transfer(_cUSD, address(community_), amount_);
        community_.addTreasuryFunds(amount_);

        emit CommunityFunded(address(community_), amount_);
    }

    /**
     * @dev Internal implementation of deploying a new community
     *
     * @param firstManager_ address of the community first manager. Will be able to add others
     * @param claimAmount_ base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim at in total
     * @param decreaseStep_ value decreased from maxClaim for every beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     * @param previousCommunity_ address of the previous community. Used for migrating communities
     * @param managerBlockList_ addresses that have to not be managers
     */
    function deployCommunity(
        address firstManager_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        uint256 minTranche_,
        uint256 maxTranche_,
        ICommunity previousCommunity_,
        address[] memory managerBlockList_
    ) internal onlyOwner returns (address) {
        TransparentUpgradeableProxy community = new TransparentUpgradeableProxy(
            address(_communityTemplate),
            address(_communityProxyAdmin),
            abi.encodeWithSignature(
                "initialize(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,address[])",
                firstManager_,
                claimAmount_,
                maxClaim_,
                decreaseStep_,
                baseInterval_,
                incrementInterval_,
                minTranche_,
                maxTranche_,
                address(previousCommunity_),
                managerBlockList_
            )
        );

        return address(community);
    }

    /** @dev Calculates the tranche amount of a community.
     *        Enforces the tranche amount to be between community minTranche and maxTranche
     * @param community_ address of the community
     * @return uint256 the value of the tranche amount
     */
    function calculateCommunityTrancheAmount(ICommunity community_)
        internal
        view
        returns (uint256)
    {
        uint256 validBeneficiaries = community_.validBeneficiaryCount();
        uint256 claimAmount = community_.claimAmount();
        uint256 treasuryFunds = community_.treasuryFunds();
        uint256 privateFunds = community_.privateFunds();

        uint256 trancheAmount = (1e36 * validBeneficiaries * (treasuryFunds + privateFunds)) /
            (claimAmount * treasuryFunds);

        if (trancheAmount < community_.minTranche()) {
            trancheAmount = community_.minTranche();
        }

        if (trancheAmount > community_.maxTranche()) {
            trancheAmount = community_.maxTranche();
        }

        return trancheAmount;
    }

    /**
     * @notice Checks if a community is deployed with the new type of smart contract
     *
     * @param community_ address of the community
     * @return bool true if the community is deployed with the new type of smart contract
     */
    function isCommunityNewType(ICommunity community_) internal view returns (bool) {
        return community_.impactMarketAddress() == address(0);
    }
}
