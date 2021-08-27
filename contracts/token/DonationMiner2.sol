//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "hardhat/console.sol";

contract DonationMiner2 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;
    using EnumerableSet for EnumerableSet.UintSet;

    event RewardClaim(address indexed user, uint256 amount);
    event DonationEvent(address indexed user, uint256 amount);

    IERC20 public immutable cUSD;
    IERC20 public immutable IPCT;
    address public treasuryAddress;
    uint256 public blocksInRewardPeriod;
    uint256 public startingRewardBlock;

    uint256 public unclaimedReward;
    uint256 public lastUnclaimedBlock;

    struct Donation {
        address donor;
        uint256 amount;
        uint256 blockNumber;
        bool isClaimed;
    }
    mapping(uint256 => Donation) private donations;
    uint256 private donationsCount;

    struct Claim {
        address donor;
        uint256 blockNumber;
        uint256 reward;
    }
    mapping(uint256 => Claim) private claims;
    uint256 private claimsCount;

    /**
     * @notice Enforces values > 0 only
     */
    modifier greaterThanZero(uint256 _value) {
        require(_value > 0, "ERR_ZERO_VALUE");
        _;
    }

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(block.number >= startingRewardBlock, "ERR_NOT_STARTED");
        _;
    }

    constructor(
        IERC20 _cUSD,
        IERC20 _IPCT,
        uint256 _startingRewardPerBlock,
        uint256 _blocksInRewardPeriod,
        uint256 _startingRewardPeriod,
        uint256 _startingRewardPeriodRatioSpan,
        address _treasuryAddress
    ) {
        require(address(_cUSD) != address(0), "_cUSD address not set!");
        require(address(_IPCT) != address(0), "_IPCT address not set!");
        require(address(_treasuryAddress) != address(0), "_treasuryAddress not set!");

        require(_startingRewardPerBlock != 0, "_startingRewardPerBlock not set!");
        require(_startingRewardPeriod != 0, "_startingRewardPeriod not set!");
        // require(_startingRewardPeriod > _getCurrentRewardPeriod(), "_startingRewardPeriod must be in future!");
        require(_startingRewardPeriodRatioSpan != 0, "_startingRewardPeriodRatioSpan not set!");

        cUSD = _cUSD;
        IPCT = _IPCT;
        treasuryAddress = _treasuryAddress;
        startingRewardBlock = _startingRewardPeriod;
        blocksInRewardPeriod = _blocksInRewardPeriod;

        lastUnclaimedBlock = _startingRewardPeriod;
    }

    function _rewardToAdd(uint256 _blockNUmber) internal view returns (uint256) {
        return (_blockNUmber - lastUnclaimedBlock) * 100e18;
    }

    /**
     * @dev Deposit cUSD tokens to the donation mining contract
     * @param _amount Amount of cUSD tokens to deposit.
     */
    function donate(uint256 _amount)
        external
        greaterThanZero(_amount)
        whenNotPaused
        whenStarted
        nonReentrant
    {
        // Transfer the cUSD from the user to the treasury
        cUSD.safeTransferFrom(address(msg.sender), address(treasuryAddress), _amount);

        donationsCount++;
        Donation storage donation = donations[donationsCount];
        donation.donor = msg.sender;
        donation.blockNumber = block.number;
        donation.amount = _amount;

        emit DonationEvent(msg.sender, _amount);
    }

    /**
     * @dev Calculate and claim all pending rewards for a user
     */
    function claimRewards() external whenNotPaused whenStarted nonReentrant {
        (uint256 userDonations, uint256 totalDonations) = calculateUserReward(block.number);

        if (userDonations == 0) {
            return;
        }

        unclaimedReward += _rewardToAdd(block.number);
        lastUnclaimedBlock = block.number;
        uint256 claimAmount;
        claimAmount = (unclaimedReward * userDonations) / totalDonations;

        unclaimedReward -= claimAmount;

        claimsCount++;
        Claim storage claim = claims[claimsCount];
        claim.blockNumber = block.number;
        claim.reward = claimAmount;
        claim.donor = msg.sender;

        if (claimAmount > 0) {
            IPCT.safeTransfer(msg.sender, claimAmount);
            emit RewardClaim(msg.sender, claimAmount);
        }
    }

    function getUnclaimedReward(uint256 _blockNumber) public view returns (uint256) {
        return unclaimedReward + _rewardToAdd(_blockNumber);
    }

    function calculateUserReward(uint256 _blockNumber) public view returns (uint256, uint256) {
        uint256 userDonations;
        uint256 totalDonations;
        uint256 iterator = donationsCount;
        uint256 startingBlock = block.number - blocksInRewardPeriod > startingRewardBlock
            ? block.number - blocksInRewardPeriod
            : startingRewardBlock;

        while (donations[iterator].blockNumber >= startingBlock) {
            if (donations[iterator].isClaimed == false && donations[iterator].donor == msg.sender) {
                userDonations = userDonations + donations[iterator].amount;
                //                donations[iterator].isClaimed = true;     !!!!!!!!!!!!must to uncomment this one
            }

            totalDonations = totalDonations + donations[iterator].amount;
            iterator--;
        }

        return (userDonations, totalDonations);
    }
}
