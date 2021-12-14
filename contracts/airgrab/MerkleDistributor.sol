//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMerkleDistributor.sol";

contract MerkleDistributor is IMerkleDistributor, Ownable {
    using SafeERC20 for IERC20;

    address public immutable override token;
    bytes32 public immutable override merkleRoot;
    uint256 public claimPeriodEndBlock;
    uint256 private constant CLAIM_PERIOD_BLOCKS = 17280 * 365;

    // This is a packed array of booleans.
    mapping(uint256 => uint256) private claimedBitMap;

    modifier withinClaimPeriod() {
        require(block.number <= claimPeriodEndBlock, "MerkleDistributor: Claim period has ended");
        _;
    }

    modifier claimPeriodEnded() {
        require(
            block.number > claimPeriodEndBlock,
            "MerkleDistributor: Claim period has not ended"
        );
        _;
    }

    constructor(address _token, bytes32 _merkleRoot) {
        token = _token;
        merkleRoot = _merkleRoot;
        claimPeriodEndBlock = block.number + CLAIM_PERIOD_BLOCKS;
    }

    function isClaimed(uint256 _index) public view override returns (bool) {
        uint256 _claimedWordIndex = _index / 256;
        uint256 _claimedBitIndex = _index % 256;
        uint256 _claimedWord = claimedBitMap[_claimedWordIndex];
        uint256 _mask = (1 << _claimedBitIndex);
        return _claimedWord & _mask == _mask;
    }

    function _setClaimed(uint256 _index) private returns (bool) {
        uint256 _claimedWordIndex = _index / 256;
        uint256 _claimedBitIndex = _index % 256;
        uint256 _claimedWord = claimedBitMap[_claimedWordIndex];
        uint256 _mask = (1 << _claimedBitIndex);

        if (_claimedWord & _mask == _mask) {
            // If already claimed signify failure
            return false;
        } else {
            // Else claim and return success
            claimedBitMap[_claimedWordIndex] = _claimedWord | _mask;
            return true;
        }
    }

    function claim(
        uint256 _index,
        address _account,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external override withinClaimPeriod {
        // Set it claimed (returns false if already claimed)
        require(_setClaimed(_index), "MerkleDistributor: Drop already claimed.");

        // Verify the merkle proof.
        bytes32 _node = keccak256(abi.encodePacked(_index, _account, _amount));
        require(
            MerkleProof.verify(_merkleProof, merkleRoot, _node),
            "MerkleDistributor: Invalid proof."
        );

        // Send the token
        IERC20(token).safeTransfer(_account, _amount);

        emit Claimed(_index, _account, _amount);
    }

    function withdrawUnclaimed() external override onlyOwner claimPeriodEnded {
        uint256 _unclaimedBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, _unclaimedBalance);
        emit Withdrawn(msg.sender, _unclaimedBalance);
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param _token address of the ERC20 token
     * @param _to address of the receiver
     * @param _amount amount of the transaction
     */
    function transfer(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner {
        _token.safeTransfer(_to, _amount);
    }
}
