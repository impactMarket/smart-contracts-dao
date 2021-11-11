// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../community/interfaces/ICommunity.sol";
import "../community/interfaces/CommunityAdminStorageV1.sol";
import "../community/Community.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdminImplementationMock is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    CommunityAdminStorageV1
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Triggered when a community has been added
     *
     * @param communityAddress  Address of the community that has been added
     * @param managers          Addresses of the initial managers
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
        address[] managers,
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
     * @param managers                 Addresses of the new community's initial managers
     * @param communityAddress         New community address
     * @param previousCommunityAddress Old community address
     */
    event CommunityMigrated(
        address[] managers,
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
        require(communities[msg.sender] == CommunityState.Valid, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    /**
     * @notice Used to initialize a new CommunityAdmin contract
     */
    function initialize() external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    //    /**
    //     * @notice Returns the state of a community
    //     *
    //     * @param communityAddress_ address of the community
    //     */
    //    function communities(address communityAddress_)
    //        external
    //        view
    //        override
    //        returns (CommunityState)
    //    {
    //        return communities[communityAddress_];
    //    }

    /**
     * @notice Returns the address of a community from communityList
     *
     * @param index index of the community
     * @return address of the community
     */
    function communityListAt(uint256 index) external view override returns (address) {
        return communityList.at(index);
    }

    /**
     * @notice Returns the number of communities
     *
     * @return uint256 number of communities
     */
    function communityListLength() external view override returns (uint256) {
        return communityList.length();
    }

    /**
     * @notice Updates the address of the treasury
     *
     * @param newTreasury_ address of the new treasury contract
     */
    function updateTreasury(ITreasury newTreasury_) external override onlyOwner {
        address oldTreasuryAddress = address(treasury);
        treasury = newTreasury_;

        emit TreasuryUpdated(oldTreasuryAddress, address(newTreasury_));
    }

    /**
     * @notice Updates the address of the the communityTemplate
     *
     * @param newCommunityTemplate_ address of the new communityTemplate contract
     */
    function updateCommunityTemplate(ICommunity newCommunityTemplate_) external override onlyOwner {
        address oldCommunityTemplateAddress = address(communityTemplate);
        communityTemplate = newCommunityTemplate_;

        emit CommunityTemplateUpdated(oldCommunityTemplateAddress, address(newCommunityTemplate_));
    }

    /**
     * @notice Adds a new community
     *
     * @param managers_ addresses of the community managers
     * @param claimAmount_ base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim at in total
     * @param decreaseStep_ value decreased from maxClaim for every beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     */
    function addCommunity(
        address[] memory managers_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        uint256 minTranche_,
        uint256 maxTranche_
    ) external override onlyOwner {
        address communityAddress = deployCommunity(
            managers_,
            claimAmount_,
            maxClaim_,
            decreaseStep_,
            baseInterval_,
            incrementInterval_,
            minTranche_,
            maxTranche_,
            ICommunity(address(0))
        );
        require(communityAddress != address(0), "CommunityAdmin::addCommunity: NOT_VALID");
        communities[communityAddress] = CommunityState.Valid;
        communityList.add(communityAddress);

        emit CommunityAdded(
            communityAddress,
            managers_,
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
     * @param managers_ address of the community managers
     * @param previousCommunity_ address of the community to be migrated
     */
    function migrateCommunity(address[] memory managers_, ICommunity previousCommunity_)
        external
        override
        onlyOwner
        nonReentrant
    {
        require(
            communities[address(previousCommunity_)] != CommunityState.Migrated,
            "CommunityAdmin::migrateCommunity: this community has been migrated"
        );

        communities[address(previousCommunity_)] = CommunityState.Migrated;

        bool isCommunityNew = isCommunityNewType(previousCommunity_);

        address newCommunityAddress;
        if (isCommunityNew) {
            newCommunityAddress = deployCommunity(
                managers_,
                previousCommunity_.claimAmount(),
                previousCommunity_.getInitialMaxClaim(),
                previousCommunity_.decreaseStep(),
                previousCommunity_.baseInterval(),
                previousCommunity_.incrementInterval(),
                previousCommunity_.minTranche(),
                previousCommunity_.maxTranche(),
                previousCommunity_
            );
        } else {
            newCommunityAddress = deployCommunity(
                managers_,
                previousCommunity_.claimAmount(),
                previousCommunity_.maxClaim(),
                1e16,
                (previousCommunity_.baseInterval() / 5),
                (previousCommunity_.incrementInterval() / 5),
                1e16,
                5e18,
                previousCommunity_
            );
        }

        require(newCommunityAddress != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");

        if (isCommunityNew) {
            uint256 balance = cUSD.balanceOf(address(previousCommunity_));
            previousCommunity_.transfer(cUSD, newCommunityAddress, balance);
        }

        communities[newCommunityAddress] = CommunityState.Valid;
        communityList.add(newCommunityAddress);

        emit CommunityMigrated(managers_, newCommunityAddress, address(previousCommunity_));
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
        require(
            communities[address(community_)] == CommunityState.Valid,
            "CommunityAdmin::removeCommunity: this isn't a valid community"
        );
        communities[address(community_)] = CommunityState.Removed;

        community_.transfer(cUSD, address(treasury), cUSD.balanceOf(address(community_)));
        emit CommunityRemoved(address(community_));
    }

    /**
     * @dev Funds an existing community if it hasn't enough funds
     */
    function fundCommunity() external override onlyCommunities {
        ICommunity community = ICommunity(msg.sender);
        uint256 balance = cUSD.balanceOf(msg.sender);
        require(
            balance < community.minTranche(),
            "CommunityAdmin::fundCommunity: this community has enough funds"
        );

        uint256 trancheAmount = calculateCommunityTrancheAmount(ICommunity(msg.sender));

        if (trancheAmount > balance) {
            transferToCommunity(community, trancheAmount - balance);
        }
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
        communityProxyAdmin.upgrade(
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
        treasury.transfer(cUSD, address(community_), amount_);
        community_.addTreasuryFunds(amount_);

        emit CommunityFunded(address(community_), amount_);
    }

    /**
     * @dev Internal implementation of deploying a new community
     *
     * @param managers_ addresses of the community managers
     * @param claimAmount_ base amount to be claim by the beneficiary
     * @param maxClaim_ limit that a beneficiary can claim at in total
     * @param decreaseStep_ value decreased from maxClaim for every beneficiary added
     * @param baseInterval_ base interval to start claiming
     * @param incrementInterval_ increment interval used in each claim
     * @param minTranche_ minimum amount that the community will receive when requesting funds
     * @param maxTranche_ maximum amount that the community will receive when requesting funds
     * @param previousCommunity_ address of the previous community. Used for migrating communities
     */
    function deployCommunity(
        address[] memory managers_,
        uint256 claimAmount_,
        uint256 maxClaim_,
        uint256 decreaseStep_,
        uint256 baseInterval_,
        uint256 incrementInterval_,
        uint256 minTranche_,
        uint256 maxTranche_,
        ICommunity previousCommunity_
    ) internal returns (address) {
        TransparentUpgradeableProxy community = new TransparentUpgradeableProxy(
            address(communityTemplate),
            address(communityProxyAdmin),
            abi.encodeWithSignature(
                "initialize(address[],uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)",
                managers_,
                claimAmount_,
                maxClaim_,
                decreaseStep_,
                baseInterval_,
                incrementInterval_,
                minTranche_,
                maxTranche_,
                address(previousCommunity_)
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
        uint256 minTranche = community_.minTranche();
        uint256 maxTranche = community_.maxTranche();

        // `treasuryFunds` can't be zero.
        // Otherwise, migrated communities will have zero.
        treasuryFunds = treasuryFunds > 0 ? treasuryFunds : 1e18;

        uint256 trancheAmount = (validBeneficiaries *
            claimAmount *
            (treasuryFunds + privateFunds)) / treasuryFunds;

        if (trancheAmount < minTranche) {
            trancheAmount = minTranche;
        } else if (trancheAmount > maxTranche) {
            trancheAmount = maxTranche;
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
