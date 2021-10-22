//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/TreasuryStorageV1.sol";

contract TreasuryImplementation is
    TreasuryStorageV1,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when CommunityAdmin has been updated
     *
     * @param oldCommunityAdmin   Old communityAdmin address
     * @param newCommunityAdmin   New communityAdmin address
     */
    event CommunityAdminUpdated(
        address indexed oldCommunityAdmin,
        address indexed newCommunityAdmin
    );

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Used to initialize a new Treasury contract
     *
     * @param communityAdmin_    Address of the CommunityAdmin contract
     */
    function initialize(ICommunityAdmin communityAdmin_) public override initializer {
        __Ownable_init();

        _communityAdmin = communityAdmin_;
    }

    /**
     * @notice Enforces sender to be communityAdmin
     */
    modifier onlyCommunityAdmin() {
        require(msg.sender == address(_communityAdmin), "Treasury: NOT_COMMUNITY_ADMIN");
        _;
    }

    /**
     * @notice Enforces sender to be communityAdmin or owner
     */
    modifier onlyCommunityAdminOrOwner() {
        require(
            msg.sender == address(_communityAdmin) || msg.sender == owner(),
            "Treasury: NOT_COMMUNITY_ADMIN AND NOT_OWNER"
        );
        _;
    }

    /**
     * @notice Returns the CommunityAdmin contract address
     */
    function communityAdmin() external view override returns (ICommunityAdmin) {
        return _communityAdmin;
    }

    /**
     * @notice Updates the CommunityAdmin contract address
     *
     * @param communityAdmin_ address of the new CommunityAdmin contract
     */
    function updateCommunityAdmin(ICommunityAdmin communityAdmin_) external override onlyOwner {
        address oldCommunityAdminAddress = address(_communityAdmin);
        _communityAdmin = communityAdmin_;

        emit CommunityAdminUpdated(oldCommunityAdminAddress, address(_communityAdmin));
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
    ) external override onlyCommunityAdminOrOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }
}
