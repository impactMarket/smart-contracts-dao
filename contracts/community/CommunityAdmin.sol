// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    using SafeERC20 for IERC20;

    IERC20 public cUSD;
    ITreasury public treasury;
    ICommunityFactory public communityFactory;

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
        IERC20 _cUSD,
        uint256 _communityMinTranche,
        uint256 _communityMaxTranche
    ) {
        require(
            _communityMinTranche < _communityMaxTranche,
            "CommunityAdmin::constructor: communityMinTranche should be less then communityMaxTranche"
        );
        cUSD = _cUSD;
        communityMinTranche = _communityMinTranche;
        communityMaxTranche = _communityMaxTranche;
    }

    modifier onlyCommunities() {
        require(communities[msg.sender] == true, "CommunityAdmin: NOT_COMMUNITY");
        _;
    }

    function setTreasury(ITreasury _newTreasury) external onlyOwner {
        treasury = _newTreasury;
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
        address communityAddress = communityFactory.deployCommunity(
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval,
            ICommunity(address(0))
        );
        require(communityAddress != address(0), "CommunityAdmin::addCommunity: NOT_VALID");
        communities[communityAddress] = true;
        emit CommunityAdded(
            communityAddress,
            _firstManager,
            _claimAmount,
            _maxClaim,
            _baseInterval,
            _incrementInterval
        );

        transferToCommunity(ICommunity(communityAddress), communityMinTranche);
    }

    /**
     * @dev Migrate community by deploying a new contract. Can be used only by an admin.
     * For further information regarding each parameter, see
     * *Community* smart contract constructor.
     */
    function migrateCommunity(
        address _firstManager,
        ICommunity _previousCommunity,
        ICommunityFactory _newCommunityFactory
    ) external onlyOwner {
        communities[address(_previousCommunity)] = false;
        require(
            address(_previousCommunity) != address(0),
            "CommunityAdmin::migrateCommunity: NOT_VALID"
        );
        ICommunity community = ICommunity(
            _newCommunityFactory.deployCommunity(
                _firstManager,
                _previousCommunity.claimAmount(),
                _previousCommunity.maxClaim(),
                _previousCommunity.baseInterval(),
                _previousCommunity.incrementInterval(),
                _previousCommunity
            )
        );
        require(address(community) != address(0), "CommunityAdmin::migrateCommunity: NOT_VALID");
        _previousCommunity.migrateFunds(community, _firstManager);
        communities[address(community)] = true;
        emit CommunityMigrated(_firstManager, address(community), address(_previousCommunity));
    }

    /**
     * @dev Remove an existing community. Can be used only by an admin.
     */
    function removeCommunity(ICommunity _community) external onlyOwner {
        communities[address(_community)] = false;
        emit CommunityRemoved(address(_community));
    }

    /**
     * @dev Set the community factory address, if the contract is valid.
     */
    function setCommunityFactory(ICommunityFactory _communityFactory) external onlyOwner {
        require(
            _communityFactory.communityAdmin() == address(this),
            "CommunityAdmin::setCommunityFactory: NOT_ALLOWED"
        );
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(address(_communityFactory));
    }

    /**
     * @dev Init community factory, used only at deploy time.
     */
    function initCommunityFactory(ICommunityFactory _communityFactory) external onlyOwner {
        require(
            address(_communityFactory) == address(0),
            "CommunityAdmin::initCommunityFactory: NOT_VALID"
        );
        communityFactory = _communityFactory;
        emit CommunityFactoryChanged(address(_communityFactory));
    }

    function fundCommunity() external onlyCommunities {
        require(
            cUSD.balanceOf(msg.sender) <= communityMinTranche,
            "CommunityAdmin::fundCommunity: this community has enough funds"
        );
        uint256 trancheAmount = calculateCommunityTrancheAmount(ICommunity(msg.sender));

        transferToCommunity(ICommunity(msg.sender), trancheAmount);
    }

    function calculateCommunityTrancheAmount(ICommunity _community) public view returns (uint256) {
        uint256 validBeneficiaries = _community.validBeneficiaryCount();
        uint256 claimAmount = _community.claimAmount();
        uint256 treasuryFunds = _community.treasuryFunds();
        uint256 privateFunds = _community.privateFunds();

        uint256 trancheAmount;
        trancheAmount =
            (10e36 * validBeneficiaries * (treasuryFunds + privateFunds)) /
            (claimAmount * treasuryFunds);

        trancheAmount = (trancheAmount > communityMinTranche) ? trancheAmount : communityMinTranche;
        trancheAmount = (trancheAmount < communityMaxTranche) ? trancheAmount : communityMaxTranche;

        return trancheAmount;
    }

    function transfer(
        IERC20 _erc20,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        _erc20.safeTransfer(_to, _amount);
    }

    function transferFromCommunity(
        ICommunity _community,
        IERC20 _erc20,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        _community.transferFunds(_erc20, _to, _amount);
    }

    function transferToCommunity(ICommunity _community, uint256 _amount) internal {
        treasury.transfer(cUSD, address(_community), _amount);
        _community.addTreasuryFunds(_amount);
    }
}
