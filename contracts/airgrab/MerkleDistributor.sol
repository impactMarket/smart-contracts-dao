//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMerkleDistributor.sol";

contract MerkleDistributor is IMerkleDistributor, Ownable {
    address public immutable override token;
    bytes32 public immutable override merkleRoot;
    uint256 public claimPeriodEndBlock;
    uint256 public constant CLAIM_PERIOD_BLOCKS = 17280 * 365;

    // This is a packed array of booleans.
    mapping(uint256 => uint256) private claimedBitMap;

    modifier withinClaimPeriod() {
        require(block.number <= claimPeriodEndBlock, "MerkelDistributor: Claim period has ended");
        _;
    }

    modifier claimPeriodEnded() {
        require(
            block.number > claimPeriodEndBlock,
            "MerkelDistributor: Claim period has not ended"
        );
        _;
    }

    constructor(address token_, bytes32 merkleRoot_) {
        token = token_;
        merkleRoot = merkleRoot_;
        claimPeriodEndBlock = block.number + CLAIM_PERIOD_BLOCKS;
    }

    function isClaimed(uint256 index) public view override returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
    }

    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external override withinClaimPeriod {
        require(!isClaimed(index), "MerkleDistributor: Drop already claimed.");

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        // Mark it claimed and send the token.
        _setClaimed(index);
        require(IERC20(token).transfer(account, amount), "MerkleDistributor: Transfer failed.");

        emit Claimed(index, account, amount);
    }

    function withdrawUnclaimed() external override onlyOwner claimPeriodEnded {
        uint256 unclaimedBalance = IERC20(token).balanceOf(address(this));
        require(
            IERC20(token).transfer(msg.sender, unclaimedBalance),
            "MerkleDistributor: Withdrawal failed."
        );
        emit Withdrawn(msg.sender, unclaimedBalance);
    }
}
