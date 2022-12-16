// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/ILearnAndEarn.sol";
import "./interfaces/LearnAndEarnStorageV1.sol";

contract LearnAndEarnImplementation is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    LearnAndEarnStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using ECDSA for bytes32;

    /**
     * @notice Triggered when a level has been funded
     *
     * @param levelId           Id of the level
     * @param sender            Address of the sender
     * @param amount            Amount of the fund
     */
    event LevelFunded(uint256 indexed levelId, address indexed sender, uint256 amount);

    /**
     * @notice Triggered when a level state has been changed
     *
     * @param levelId           Id of the level
     * @param state             New state of the level
     */
    event LevelStateChanged(uint256 indexed levelId, LevelState indexed state);

    /**
     * @notice Triggered when a reward has been claimed
     *
     * @param beneficiary    address of the beneficiary to be rewarded
     * @param levelId       the id of the level
     */
    event RewardClaimed(address indexed beneficiary, uint256 indexed levelId);

    /**
     * @notice Enforces sender to be a valid community
     */
    modifier onlyOwnerOrImpactMarketCouncil() {
        require(
            msg.sender == owner() || msg.sender == address(communityAdmin.impactMarketCouncil()),
            "LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
        );
        _;
    }

    /**
     * @notice Used to initialize a new CommunityAdmin contract
     *
     * @param _signerWalletAddress    Address of the backend wallet
     */
    function initialize(address _signerWalletAddress, ICommunityAdmin _communityAdmin)
        external
        initializer
    {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init_unchained();

        signerWalletAddress = _signerWalletAddress;
        communityAdmin = _communityAdmin;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the id of a level from levelList
     *
     * @param _index index of the level
     * @return id of the level
     */
    function levelListAt(uint256 _index) external view override returns (uint256) {
        return _levelList.at(_index);
    }

    /**
     * @notice Returns the number of levels
     *
     * @return uint256 number of levels
     */
    function levelListLength() external view override returns (uint256) {
        return _levelList.length();
    }

    /**
     * @notice Returns the reward amount claimed by a beneficiary for a level
     *
     * @param _levelId id of the level
     * @param _beneficiary address of the beneficiary
     * @return reward amount claimed by the beneficiary for a level
     */
    function levelClaims(uint256 _levelId, address _beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return levels[_levelId].claims[_beneficiary];
    }

    /**
     * @dev Pauses the contract
     */
    function pause() public onlyOwnerOrImpactMarketCouncil {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyOwnerOrImpactMarketCouncil {
        _unpause();
    }

    /** Updates the address of the backend wallet
     *
     * @param _newSignerWalletAddress address of the new backend wallet
     */
    function updateSignerWalletAddress(address _newSignerWalletAddress)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        signerWalletAddress = _newSignerWalletAddress;
    }

    /**
     * @notice Updates the CommunityAdmin contract address
     *
     * @param _newCommunityAdmin address of the new CommunityAdmin contract
     */
    function updateCommunityAdmin(ICommunityAdmin _newCommunityAdmin) external override onlyOwner {
        communityAdmin = _newCommunityAdmin;
    }

    /**
     * @notice Adds a new level
     *
     * @param _levelId    the id of the level
     * @param _token      the token used for reward
     */
    function addLevel(uint256 _levelId, IERC20 _token)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        require(
            levels[_levelId].state == LevelState.Invalid,
            "LearnAndLearn::addLevel: Invalid level id"
        );

        levels[_levelId].state = LevelState.Valid;
        levels[_levelId].token = _token;

        _levelList.add(_levelId);

        emit LevelStateChanged(_levelId, LevelState.Valid);
    }

    /**
     * @notice Pauses a level
     *
     * @param _levelId id of the level
     */
    function pauseLevel(uint256 _levelId) external override onlyOwnerOrImpactMarketCouncil {
        Level storage _level = levels[_levelId];

        require(_level.state == LevelState.Valid, "LearnAndEarn::pauseLevel: Invalid level id");

        _level.state = LevelState.Paused;

        emit LevelStateChanged(_levelId, LevelState.Paused);
    }

    /**
     * @notice Unpauses a level
     *
     * @param _levelId id of the level
     */
    function unpauseLevel(uint256 _levelId) external override onlyOwnerOrImpactMarketCouncil {
        Level storage _level = levels[_levelId];

        require(_level.state == LevelState.Paused, "LearnAndEarn::unpauseLevel: Invalid level id");

        _level.state = LevelState.Valid;

        emit LevelStateChanged(_levelId, LevelState.Valid);
    }

    /**
     * @notice Cancels a level
     *
     * @param _levelId id of the level
     * @param _fundRecipient the address of the recipient who will receive the funds allocated for this level
     */
    function cancelLevel(uint256 _levelId, address _fundRecipient)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        Level storage _level = levels[_levelId];

        require(
            _level.state == LevelState.Valid || _level.state == LevelState.Paused,
            "LearnAndEarn::cancelLevel: Invalid level id"
        );

        _level.state = LevelState.Canceled;
        uint256 _levelBalance = _level.balance;
        _level.balance = 0;

        _level.token.safeTransfer(_fundRecipient, _levelBalance);

        emit LevelStateChanged(_levelId, LevelState.Canceled);
    }

    /**
     * @notice Funds a level
     *
     * @param _levelId   the id of the level
     * @param _amount the amount to be funded
     */
    function fundLevel(uint256 _levelId, uint256 _amount) external override {
        Level storage _level = levels[_levelId];

        require(
            _level.state == LevelState.Valid || _level.state == LevelState.Paused,
            "LearnAndEarn::fundLevel: Invalid level id"
        );

        _level.token.safeTransferFrom(msg.sender, address(this), _amount);

        _level.balance += _amount;

        emit LevelFunded(_levelId, msg.sender, _amount);
    }

    /**
     * @notice Allows beneficiaries to claim the reward for a list of levels using a signature
     *
     * @param _beneficiary     address of the beneficiary to be rewarded
     * @param _levelIds        the ids of the levels
     * @param _rewardAmounts   the amounts of the tokens to be send to the beneficiary as reward for each level
     * @param _signatures      the signatures from the backend
     */
    function claimRewardForLevels(
        address _beneficiary,
        uint256[] calldata _levelIds,
        uint256[] calldata _rewardAmounts,
        bytes[] calldata _signatures
    ) external override {
        Level storage _level;

        require(
            _levelIds.length == _rewardAmounts.length && _levelIds.length == _signatures.length,
            "LearnAndEarn::claimRewardForLevels: Invalid data"
        );

        uint256 _index;
        bytes32 _messageHash;

        for (_index = 0; _index < _levelIds.length; _index++) {
            _level = levels[_levelIds[_index]];

            require(
                _level.state == LevelState.Valid,
                "LearnAndEarn::claimRewardForLevels: Invalid level id"
            );

            //if the beneficiary has already claimed the reward for this level,
            // or if the rewardAmount is 0, skip this level
            if (_level.claims[_beneficiary] > 0 || _rewardAmounts[_index] == 0) {
                continue;
            }

            _messageHash = keccak256(
                abi.encode(_beneficiary, _levelIds[_index], _rewardAmounts[_index])
            );

            require(
                signerWalletAddress ==
                    _messageHash.toEthSignedMessageHash().recover(_signatures[_index]),
                "LearnAndEarn::claimRewardForLevels: Invalid signature"
            );

            _level.claims[_beneficiary] = _rewardAmounts[_index];

            require(
                _level.balance >= _rewardAmounts[_index],
                "LearnAndEarn::claimRewardForLevels: Level doesn't have enough funds"
            );

            _level.token.safeTransfer(_beneficiary, _rewardAmounts[_index]);
            _level.balance -= _rewardAmounts[_index];

            emit RewardClaimed(_beneficiary, _levelIds[_index]);
        }
    }
}
