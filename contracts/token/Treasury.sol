//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../community/interfaces/ICommunityAdmin.sol";

import "hardhat/console.sol";

contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public cUSD;
    ICommunityAdmin public communityAdmin;

    constructor(IERC20 _cUSD, ICommunityAdmin _communityAdmin) public {
        cUSD = _cUSD;
        communityAdmin = _communityAdmin;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == address(communityAdmin), "Treasury: NOT_COMMUNITY_ADMIN");
        _;
    }

    modifier onlyCommunityAdminOrOwner() {
        require(
            msg.sender == address(communityAdmin) || msg.sender == owner(),
            "Treasury: NOT_COMMUNITY_ADMIN AND NOT_OWNER"
        );
        _;
    }

    function setCommunityAdmin(ICommunityAdmin _communityAdmin) external onlyOwner {
        communityAdmin = _communityAdmin;
    }

    function transfer(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external onlyCommunityAdminOrOwner {
        _token.safeTransfer(_to, _amount);
    }
}
