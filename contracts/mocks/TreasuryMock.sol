//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "../token/Treasury.sol";

import "hardhat/console.sol";

contract TreasuryMock is Treasury {
    address private _owner;

    constructor(ICommunityAdmin communityAdmin_) Treasury(communityAdmin_) {
        _owner = msg.sender;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public override {
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
