//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/AirdropV2StorageV1.sol";

contract AirdropV2Implementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    AirdropV2StorageV1
{
    using SafeERC20Upgradeable for IERC20;

    /**
     * @notice Triggered after a claim
     *
     * @param beneficiary         The address of the beneficiary that has claimed
     * @param amount              The amount of the claim
     */
    event Claimed(address indexed beneficiary, uint256 amount);

    /**
     * @notice Used to initialize a new Airdrop contract
     *
     * @param _PACTAddress      The address of the PACT token
     * @param _startTime        The timestamp when the airdrop will be available
     * @param _trancheAmount    The number of PACTs to be claimed in one transaction
     * @param _totalAmount      The total number of PACTs to be claimed by a beneficiary
     * @param _cooldown         The minimum number of seconds between two claims
     * @param _merkleRoot       The root of the merkle tree
     */
    function initialize(
        address _PACTAddress,
        uint256 _startTime,
        uint256 _trancheAmount,
        uint256 _totalAmount,
        uint256 _cooldown,
        bytes32 _merkleRoot
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        PACT = IERC20(_PACTAddress);
        startTime = _startTime;
        trancheAmount = _trancheAmount;
        totalAmount = _totalAmount;
        cooldown = _cooldown;
        merkleRoot = _merkleRoot;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Updates the startTime value
     *
     * @param _newStartTime the new start timestamp
     */
    function updateStartTime(uint256 _newStartTime) external override onlyOwner {
        startTime = _newStartTime;
    }

    /**
     * @notice Updates the trancheAmount value
     *
     * @param _newTrancheAmount the new trancheAmount
     */
    function updateTrancheAmount(uint256 _newTrancheAmount) external override onlyOwner {
        trancheAmount = _newTrancheAmount;
    }

    /**
     * @notice Updates the totalAmount value
     *
     * @param _newTotalAmount the new totalAmount
     */
    function updateTotalAmount(uint256 _newTotalAmount) external override onlyOwner {
        totalAmount = _newTotalAmount;
    }

    /**
     * @notice Updates the cooldown value
     *
     * @param _newCooldown the new cooldown timestamp
     */
    function updateCooldown(uint256 _newCooldown) external override onlyOwner {
        cooldown = _newCooldown;
    }

    /**
     * @notice Updates the merkleRoot
     *
     * @param _newMerkleRoot the new merkleRoot
     */
    function updateMerkleRoot(bytes32 _newMerkleRoot) external override onlyOwner {
        merkleRoot = _newMerkleRoot;
    }

    /**
     * @notice Transfers PACTs to a beneficiary
     *
     * @param _beneficiaryAddress the address of the beneficiary
     * @param _merkleProof the proof vor validating the beneficiary
     */
    function claim(address _beneficiaryAddress, bytes32[] calldata _merkleProof) external override {
        require(startTime <= block.timestamp, "AirdropV2Implementation::claim: Not yet");

        Beneficiary storage _beneficiary = beneficiaries[_beneficiaryAddress];

        //we have to check if the address is a beneficiary only first time
        if (_beneficiary.claimedAmount == 0) {
            // Verify the merkle proof.
            bytes32 _leafToCheck = keccak256(abi.encodePacked(_beneficiaryAddress));
            require(
                MerkleProof.verify(_merkleProof, merkleRoot, _leafToCheck),
                "AirdropV2Implementation::claim: Incorrect proof"
            );
        }

        require(
            _beneficiary.lastClaimTime + cooldown <= block.timestamp,
            "AirdropV2Implementation::claim: Not yet"
        );

        require(
            _beneficiary.claimedAmount < totalAmount,
            "AirdropV2Implementation::claim: Beneficiary's claimed all amount"
        );

        uint256 _toClaim = totalAmount - _beneficiary.claimedAmount;

        uint256 _claimAmount = _toClaim > trancheAmount ? trancheAmount : _toClaim;

        _beneficiary.claimedAmount += _claimAmount;
        _beneficiary.lastClaimTime = block.timestamp;

        // Send the token
        PACT.safeTransfer(_beneficiaryAddress, _claimAmount);

        emit Claimed(_beneficiaryAddress, _claimAmount);
    }
}
