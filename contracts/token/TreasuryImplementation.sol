//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../community/interfaces/ICommunityAdmin.sol";
import "./interfaces/TreasuryStorageV1.sol";

import "hardhat/console.sol";

contract TreasuryImplementation is
    TreasuryStorageV1,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a donation has been added
     *
     * @param oldCommunityAdmin   Old communityAdmin address
     * @param newCommunityAdmin   New communityAdmin address
     */
    event CommunityAdminChanged(
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

    function initialize(ICommunityAdmin communityAdmin_) public override initializer {
        __Ownable_init();

        _communityAdmin = communityAdmin_;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == address(_communityAdmin), "Treasury: NOT_COMMUNITY_ADMIN");
        _;
    }

    modifier onlyCommunityAdminOrOwner() {
        require(
            msg.sender == address(_communityAdmin) || msg.sender == owner(),
            "Treasury: NOT_COMMUNITY_ADMIN AND NOT_OWNER"
        );
        _;
    }

    function communityAdmin() external view override returns (ICommunityAdmin) {
        return _communityAdmin;
    }

    function setCommunityAdmin(ICommunityAdmin communityAdmin_) external override onlyOwner {
        address oldCommunityAdminAddress = address(_communityAdmin);
        _communityAdmin = communityAdmin_;

        emit CommunityAdminChanged(oldCommunityAdminAddress, address(_communityAdmin));
    }

    function transfer(
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyCommunityAdminOrOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }
}
