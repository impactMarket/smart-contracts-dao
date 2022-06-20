//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/StakingStorageV1.sol";

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
     * @notice Triggered when some tokens have been partially claimed
     *
     * @param holder          Address of the holder
     * @param amount          Claim amount
     * @param lastUnstakeId   Last unstake is to be claimed (if possible)
     */
    event ClaimedPartial(address indexed holder, uint256 amount, uint256 lastUnstakeId);

    /**
     * @notice Triggered when the cooldown value has been updated
     *
     * @param oldCooldown            Old cooldown value
     * @param newCooldown            New cooldown value
     */
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    /**
     * @notice Used to initialize a new DonationMiner contract
     *
     * @param _PACT                 Address of the PACT Token
     * @param _SPACT                Address of the SPACT Token
     * @param _donationMiner        Address of the DonationMiner
     * @param _cooldown             Number of blocks after a user can claim an unstake
     */
    function initialize(
        IERC20 _PACT,
        IMintableERC20 _SPACT,
        IDonationMiner _donationMiner,
        uint256 _cooldown
    ) public initializer {
        require(address(_PACT) != address(0), "Stake::initialize: invalid _PACT address");
        require(address(_SPACT) != address(0), "Stake::initialize: invalid _SPACT address");
        require(
            address(_donationMiner) != address(0),
            "Stake::initialize: invalid _donationMiner address"
        );

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

    /**
     * @notice Updates cooldown value
     *
     * @param _newCooldown        Number of blocks after a user can claim an unstake
     */
    function updateCooldown(uint256 _newCooldown) external override onlyOwner {
        emit CooldownUpdated(cooldown, _newCooldown);

        cooldown = _newCooldown;
    }

    function stakeholderAmount(address _holderAddress) external view override returns (uint256) {
        return _holders[_holderAddress].amount;
    }

    function stakeholder(address _holderAddress)
        external
        view
        override
        returns (
            uint256 amount,
            uint256 nextUnstakeId,
            uint256 unstakeListLength,
            uint256 unstakedAmount
        )
    {
        Holder storage _holder = _holders[_holderAddress];
        return (
            _holder.amount,
            _holder.nextUnstakeId,
            _holder.unstakes.length,
            SPACT.balanceOf(_holderAddress) - _holder.amount
        );
    }

    function stakeholderUnstakeAt(address _holderAddress, uint256 _unstakeIndex)
        external
        view
        override
        returns (Unstake memory)
    {
        return _holders[_holderAddress].unstakes[_unstakeIndex];
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
        require(_amount <= type(uint96).max, "Stake::stake: Stake amount too big");

        PACT.safeTransferFrom(msg.sender, address(this), _amount);
        SPACT.mint(_holderAddress, uint96(_amount));

        //.add method checks if the stakeholdersList already contains this address
        stakeholdersList.add(_holderAddress);

        Holder storage _holder = _holders[_holderAddress];

        _holder.amount += _amount;
        currentTotalAmount += _amount;

        donationMiner.setStakingAmounts(_holderAddress, _holder.amount, currentTotalAmount);

        emit Staked(_holderAddress, _amount);
    }

    /**
     * @notice Unstake
     *
     * @param _amount number of tokens to be unstaked
     */
    function unstake(uint256 _amount) external override {
        require(_amount > 0, "Stake::unstake: Unstake amount should not be 0");
        require(_amount <= type(uint96).max, "Stake::unstake: Unstake amount too big");

        Holder storage _holder = _holders[msg.sender];

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
        require(_holders[msg.sender].unstakes.length > 0, "Stake::claim: No funds to claim");

        emit Claimed(msg.sender, _claim(_holders[msg.sender].unstakes.length - 1));
    }

    /**
     * @notice Claim all unstakes until _lastUnstakeId
     */
    function claimPartial(uint256 _lastUnstakeId) external override nonReentrant {
        require(
            _lastUnstakeId < _holders[msg.sender].unstakes.length,
            "Stake::claimPartial: lastUnstakeId too big"
        );

        emit ClaimedPartial(msg.sender, _claim(_lastUnstakeId), _lastUnstakeId);
    }

    function claimAmount(address _holderAddress) external view override returns (uint256) {
        Holder storage _holder = _holders[_holderAddress];

        if (_holder.unstakes.length == 0) {
            return 0;
        }

        uint256 _index = _holder.nextUnstakeId;
        uint256 _amount;

        while (
            _index < _holder.unstakes.length &&
            _holder.unstakes[_index].cooldownBlock < block.number
        ) {
            _amount += _holder.unstakes[_index].amount;
            _index++;
        }

        return _amount;
    }

    function _claim(uint256 _lastUnstakeId) internal returns (uint256) {
        Holder storage _holder = _holders[msg.sender];

        uint256 _index = _holder.nextUnstakeId;
        uint256 _amount;

        while (_index <= _lastUnstakeId && _holder.unstakes[_index].cooldownBlock < block.number) {
            _amount += _holder.unstakes[_index].amount;
            _index++;
        }

        require(_amount > 0, "Stake::claim: No funds to claim");

        _holder.nextUnstakeId = _index;

        SPACT.burn(msg.sender, uint96(_amount));
        PACT.safeTransfer(msg.sender, _amount);

        return _amount;
    }
}
