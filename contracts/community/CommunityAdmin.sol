// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/ICommunityFactory.sol";
import "./Community.sol";
import "../token/interfaces/ITreasury.sol";

import "hardhat/console.sol";

/**
 * @notice Welcome to CommunityAdmin, the main contract. This is an
 * administrative (for now) contract where the admins have control
 * over the list of communities. Being only able to add and
 * remove communities
 */
contract CommunityAdmin is Ownable {
    address public cUSDAddress;
    address public treasuryAddress;
    address public communityFactory;

    mapping(address => bool) public communities;
    uint256 public communityMinTranche;
    uint256 public communityMaxTranche;

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
    event CommunityMinTrancheChanged(uint256 indexed _newCommunityMinTranche);
    event CommunityMaxTrancheChanged(uint256 indexed _newCommunitMaxTranche);

    /**
     * @dev It sets the first admin, which later can add others
     * and add/remove communities.
     */
    constructor(
        address _cUSDAddress,
        uint256 _communityMinTranche,
        uint256 _communityMaxTranche
    ) public {
        require(
            _communityMinTranche < _communityMaxTranche,
            "CommunityAdmin::constructor: communityMinTranche should be less then communityMaxTranche"
        );
        cUSDAddress = _cUSDAddress;
        communityMinTranche = _communityMinTranche;
        communityMaxTranche = _communityMaxTranche;
    }

    modifier onlyCommunities() {
        require(communities[msg.sender] == true, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    function setTreasury(address _newTreasuryAddress) external onlyOwner {
        treasuryAddress = _newTreasuryAddress;
    }

    /**
     * @dev Set the community min tranche
     */
    function setCommunityMinTranche(uint256 _newCommunityMinTranche) external onlyOwner {
        require(
            _newCommunityMinTranche < communityMaxTranche,
            "CommunityAdmin::setCommunityMinTranche: New communityMinTranche should be less then communityMaxTranche"
        );
        communityMinTranche = _newCommunityMinTranche;
        emit CommunityMinTrancheChanged(_newCommunityMinTranche);
    }

    /**
     * @dev Set the community max tranche
     */
    function setCommunityMaxTranche(uint256 _newCommunityMaxTranche) external onlyOwner {
        require(
            communityMinTranche < _newCommunityMaxTranche,
            "CommunityAdmin::setCommunityMaxTranche: New communityMaxTranche should be greater then communityMinTranche"
        );
        communityMaxTranche = _newCommunityMaxTranche;
        emit CommunityMaxTrancheChanged(_newCommunityMaxTranche);
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
    ) external onlyOwner {
        address community = ICommunityFactory(communityFactory).deployCommunity(
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval,
            address(0)
        );
        require(community != address(0), "CommunityAdmin::addCommunity: NOT_VALID");
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
    ) external onlyOwner {
        communities[_previousCommunityAddress] = false;
        require(
            address(_previousCommunityAddress) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );
        ICommunity previousCommunity = ICommunity(_previousCommunityAddress);
        address community = ICommunityFactory(_newCommunityFactory).deployCommunity(
            _firstManager,
            previousCommunity.claimAmount(),
            previousCommunity.maxClaim(),
            previousCommunity.baseInterval(),
            previousCommunity.incrementInterval(),
            _previousCommunityAddress
        );
        require(community != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");
        previousCommunity.migrateFunds(community, _firstManager);
        communities[community] = true;
        emit CommunityMigrated(_firstManager, community, _previousCommunityAddress);
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(address _community) external onlyOwner {
        communities[_community] = false;
        emit CommunityRemoved(_community);
    }

    /**
     * @dev Set the community factory address, if the contract is valid.
     */
    function setCommunityFactory(address _communityFactory) external onlyOwner {
        ICommunityFactory factory = ICommunityFactory(_communityFactory);
        require(
            factory.communityAdminAddress() == address(this),
            "CommunityAdmin::setCommunityFactory: NOT_ALLOWED"
        );
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(_communityFactory);
    }

    /**
     * @dev Init community factory, used only at deploy time.
     */
    function initCommunityFactory(address _communityFactory) external onlyOwner {
        require(communityFactory == address(0), "");
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(_communityFactory);
    }

    function fundCommunity() external onlyCommunities {
        require(
            IERC20(cUSDAddress).balanceOf(msg.sender) <= communityMinTranche,
            "CommunityAdmin::fundCommunity: you have enough funds"
        );
        uint256 trancheAmount = calculateCommunityTrancheAmount(msg.sender);

        console.log("fundCommunity");
        ITreasury(treasuryAddress).transferToCommunity(msg.sender, trancheAmount);
    }

    function calculateCommunityTrancheAmount(address _community) public returns (uint256) {
        ICommunity community = ICommunity(_community);
        uint256 validBeneficiaries = community.validBeneficiaryCount();
        uint256 claimAmount = community.claimAmount();
        uint256 governanceDonations = community.governanceDonations();
        uint256 privateDonations = community.privateDonations();

        //I multiplied some variables with 1000 and then I divided the result in order to have much more precision
        uint256 trancheAmount = (validBeneficiaries * 10**21) / claimAmount;
        uint256 bonusFactor = (governanceDonations > 0)
            ? ((governanceDonations + privateDonations) * 1000) / governanceDonations
            : 1000;
        trancheAmount = (trancheAmount * bonusFactor) / 1000000;

        trancheAmount = (trancheAmount > communityMinTranche) ? trancheAmount : communityMinTranche;
        trancheAmount = (trancheAmount < communityMaxTranche) ? trancheAmount : communityMaxTranche;

        return trancheAmount;
    }
}
