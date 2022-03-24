//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/StakingStorageV1.sol";

import "hardhat/console.sol";

contract StakingImplementation is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    StakingStorageV1
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Triggered when some tokens have been staked
     *
     * @param holder     Address of the holder
     * @param amount     Stake amount
     */
    event Staked(address indexed holder, uint256 amount);

    /**
     * @notice Triggered when some tokens have been unstaked
     *
     * @param holder     Address of the holder
     * @param amount     Unstake amount
     */
    event Unstaked(address indexed holder, uint256 amount);

    /**
     * @notice Triggered when some tokens have been claimed
     *
     * @param holder     Address of the holder
     * @param amount     Claim amount
     */
    event Claimed(address indexed holder, uint256 amount);

    /**
     * @notice Used to initialize a new DonationMiner contract
     *
     * @param _PACT                 Address of the PACT Token
     * @param _SPACT                Address of the SPACT Token
     * @param _donationMiner        Address of the DonationMiner
     * @param _cooldown   Number of blocks after a user can claim a stake
     */
    function initialize(
        IERC20 _PACT,
        IMintableToken _SPACT,
        IDonationMiner _donationMiner,
        uint256 _cooldown
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        PACT = _PACT;
        SPACT = _SPACT;
        donationMiner = _donationMiner;
        cooldown = _cooldown;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    function stakeholderAmount(address _holderAddress) external view override returns (uint256) {
        return holders[_holderAddress].amount;
    }

    /**
     * @notice Returns the address of a stakeholder from stakeholdersList
     *
     * @param _index index of the stakeholder
     * @return address of the stakeholder
     */
    function stakeholdersListAt(uint256 _index) external view override returns (address) {
        return stakeholdersList.at(_index);
    }

    /**
     * @notice Returns the number of stakeholders
     *
     * @return uint256 number of stakeholders
     */
    function stakeholdersListLength() external view override returns (uint256) {
        return stakeholdersList.length();
    }

    /**
     * @notice Stakes new founds for the holder
     *
     * @param _holderAddress Address of the holder
     * @param _amount Amount of cUSD tokens to stake
     */
    function stake(address _holderAddress, uint256 _amount) external override nonReentrant {
        require(_amount > 0, "Stake::stake: Amount can't be 0");

        PACT.safeTransferFrom(msg.sender, address(this), _amount);
        SPACT.mint(_holderAddress, uint96(_amount));

        //.add method checks if the stakeholdersList already contains this address
        stakeholdersList.add(_holderAddress);

        holders[_holderAddress].amount += _amount;
        currentTotalAmount += _amount;

        donationMiner.setStakingAmounts(
            _holderAddress,
            holders[_holderAddress].amount,
            currentTotalAmount
        );

        emit Staked(_holderAddress, _amount);
    }

    /**
     * @notice Unstake
     *
     * @param _amount number of tokens to be unstaked
     */
    function unstake(uint256 _amount) external override {
        require(_amount > 0, "Stake::unstake: Unstake amount should not be 0");

        Holder storage _holder = holders[msg.sender];

        require(_holder.amount >= _amount, "Stake::unstake: Not enough funds");

        _holder.unstakes.push(Unstake({amount: _amount, cooldownBlock: block.number + cooldown}));

        _holder.amount -= _amount;
        currentTotalAmount -= _amount;

        donationMiner.setStakingAmounts(msg.sender, _holder.amount, currentTotalAmount);

        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @notice Claim all unstakes that are older than cooldown
     */
    function claim() external override nonReentrant {
        Holder storage _holder = holders[msg.sender];

        uint256 _index = _holder.nextUnstakeId;
        uint256 _amount;

        while (
            _index < _holder.unstakes.length &&
            _holder.unstakes[_index].cooldownBlock < block.number
        ) {
            _amount += _holder.unstakes[_index].amount;
            _index++;
        }

        require(_amount > 0, "Stake::claim: No funds to claim");

        _holder.nextUnstakeId = _index;

        SPACT.burn(msg.sender, uint96(_amount));
        PACT.safeTransfer(msg.sender, _amount);

        emit Claimed(msg.sender, _amount);
    }
}
