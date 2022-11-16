//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
    // Returns the address of the token distributed by this contract.
    function token() external view returns (address);
    // Returns the merkle root of the merkle tree containing account balances available to claim.
    function merkleRoot() external view returns (bytes32);
    // Returns true if the index has been marked claimed.
    function isClaimed(uint256 _index) external view returns (bool);
    // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
    function claim(uint256 _index, address _account, uint256 _amount, bytes32[] calldata _merkleProof) external;
    // Withdraw the unclaimed tokens after the claim period ends
    function withdrawUnclaimed() external;
    // Transfers an amount of an ERC20 from this contract to an address
    function transfer(IERC20 _token, address _to, uint256 _amount) external;


    // This event is triggered whenever a call to #claim succeeds.
    event Claimed(uint256 _index, address _account, uint256 _amount);
    // This event is triggered whenever the unclaimed tokens are withdrawn
    event Withdrawn(address _treasury, uint256 _amount);
}
