//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "hardhat/console.sol";
import "../community/interfaces/ICommunityAdmin.sol";

contract Treasury {
    using SafeERC20 for IERC20;

    address public admin;
    IERC20 public cUSD;
    ICommunityAdmin public communityAdmin;

    constructor(
        IERC20 _cUSD,
        address _admin,
        ICommunityAdmin _communityAdmin
    ) public {
        cUSD = _cUSD;
        admin = _admin;
        communityAdmin = _communityAdmin;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Treasury: NOT_ADMIN");
        _;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == address(communityAdmin), "Treasury: NOT_COMMUNITY_ADMIN");
        _;
    }

    modifier onlyCommunityAdminOrAdmin() {
        require(
            msg.sender == address(communityAdmin) || msg.sender == admin,
            "Treasury: NOT_COMMUNITY_ADMIN AND NOT_COMMUNITY_ADMIN"
        );
        _;
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    function setCommunityAdmin(ICommunityAdmin _communityAdmin) external onlyAdmin {
        communityAdmin = _communityAdmin;
    }

    function transfer(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyCommunityAdminOrAdmin {
        _token.safeTransfer(_to, _amount);
    }
}
