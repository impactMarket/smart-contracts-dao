//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../community/CommunityAdmin.sol";

import "hardhat/console.sol";

contract CommunityAdminMock is CommunityAdmin {
    address private _owner;

    constructor(
        address _cUSDAddress,
        uint256 _communityMinTranche,
        uint256 _communityMaxTranche
    ) public CommunityAdmin(_cUSDAddress, _communityMinTranche, _communityMaxTranche) {
        _owner = msg.sender;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public override {
        console.log("transferOwnership mock");
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view override returns (address) {
        return _owner;
    }
}
