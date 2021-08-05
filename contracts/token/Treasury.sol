//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract Treasury {
    address public cUSDAddress;
    address public admin;
    address public communityAdmin;

    constructor(
        address _cUSDAddress,
        address _admin,
        address _communityAdmin
    ) public {
        cUSDAddress = _cUSDAddress;
        admin = _admin;
        communityAdmin = _communityAdmin;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Treasury: NOT_ADMIN");
        _;
    }

    modifier onlyCommunityAdmin() {
        require(msg.sender == communityAdmin, "Treasury: NOT_COMMUNITY_ADMIN");
        _;
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    function setCommunityAdmin(address _communityAdmin) external onlyAdmin {
        communityAdmin = _communityAdmin;
    }

    function transferToCommunity(address _communityAddress, uint256 _amount)
        external
        onlyCommunityAdmin
    {
        bool success = IERC20(cUSDAddress).transfer(_communityAddress, _amount);
        require(success, "CommunityAdmin::fundCommunity: Something went wrong");
    }
}
