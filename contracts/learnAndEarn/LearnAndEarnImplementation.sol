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
     * @notice Triggered when a program has been funded
     *
     * @param programId         Id of the program
     * @param levelId           Id of the program level
     * @param sender            Address of the sender
     * @param amount            Amount of the fund
     */
    event ProgramLevelFunded(
        uint256 indexed programId,
        uint256 indexed levelId,
        address indexed sender,
        uint256 amount
    );

    /**
     * @notice Triggered when a program has been created
     *
     * @param programId         Id of the program
     */
    event ProgramAdded(uint256 indexed programId);

    /**
     * @notice Triggered when a program level state has been changed
     *
     * @param programId         Id of the program
     * @param levelId           Id of the program
     * @param state             New state of the program
     */
    event LevelStateChanged(
        uint256 indexed programId,
        uint256 indexed levelId,
        LevelState indexed state
    );

    /**
     * @notice Triggered when a reward has been claimed
     *
     * @param beneficiary    address of the beneficiary to be rewarded
     * @param programId      the id of the program
     * @param levelId       the id of the level
     */
    event RewardClaimed(
        address indexed beneficiary,
        uint256 indexed programId,
        uint256 indexed levelId
    );

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

    function programs(uint256 _programId)
        external
        view
        override
        returns (string memory name, IERC20 token)
    {
        Program storage _program = _programs[_programId];
        name = _program.name;
        token = _program.token;
    }

    function programLevels(uint256 _programId, uint256 _levelId)
        external
        view
        override
        returns (uint256 balance, LevelState state)
    {
        Level storage _level = _programs[_programId].levels[_levelId];
        balance = _level.balance;
        state = _level.state;
    }

    /**
     * @notice Returns the reward amount claimed by a beneficiary for a level
     *
     * @param _programId id of the program
     * @param _levelId id of the level
     * @param _beneficiary address of the beneficiary
     * @return reward amount claimed by the beneficiary for a level
     */
    function programLevelClaims(
        uint256 _programId,
        uint256 _levelId,
        address _beneficiary
    ) external view override returns (uint256) {
        return _programs[_programId].levels[_levelId].claims[_beneficiary];
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
     * @notice Adds a new program
     *
     * @param _programId  the id of the program
     * @param _name       the name of the program
     * @param _token      the token used for reward
     */
    function addProgram(
        uint256 _programId,
        string calldata _name,
        IERC20 _token
    ) external override onlyOwnerOrImpactMarketCouncil {
        require(address(_token) != address(0), "LearnAndLearn::addProgram: Invalid token");

        Program storage _program = _programs[_programId];

        require(
            address(_program.token) == address(0),
            "LearnAndLearn::addProgram: Invalid program id"
        );

        _program.name = _name;
        _program.token = _token;

        emit ProgramAdded(_programId);
    }

    /**
     * @notice Adds a new program level
     *
     * @param _programId  the id of the program
     * @param _levelId    the id of the level
     */
    function addProgramLevel(uint256 _programId, uint256 _levelId)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        Program storage _program = _programs[_programId];

        require(
            address(_program.token) != address(0),
            "LearnAndLearn::addProgramLevel: Invalid program id"
        );

        require(
            _program.levels[_levelId].state == LevelState.Invalid,
            "LearnAndLearn::addProgramLevel: Invalid program level id"
        );

        _program.levels[_levelId].state = LevelState.Valid;

        emit LevelStateChanged(_programId, _levelId, LevelState.Valid);
    }

    /**
     * @notice Funds a program level
     *
     * @param _programId the id of the program
     * @param _levelId   the id of the program level
     * @param _amount the amount to be funded
     */
    function fundProgramLevel(
        uint256 _programId,
        uint256 _levelId,
        uint256 _amount
    ) external override {
        Program storage _program = _programs[_programId];
        Level storage _level = _program.levels[_levelId];

        require(
            _level.state == LevelState.Valid || _level.state == LevelState.Paused,
            "LearnAndEarn::fundProgram: Invalid program level id"
        );

        _program.token.safeTransferFrom(msg.sender, address(this), _amount);

        _level.balance += _amount;

        emit ProgramLevelFunded(_programId, _levelId, msg.sender, _amount);
    }

    /**
     * @notice Pauses a program level
     *
     * @param _programId id of the program
     * @param _levelId id of the program level
     */
    function pauseProgramLevel(uint256 _programId, uint256 _levelId)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        Program storage _program = _programs[_programId];
        Level storage _level = _program.levels[_levelId];

        require(
            _level.state == LevelState.Valid,
            "LearnAndEarn::pauseProgram: Invalid program level id"
        );

        _level.state = LevelState.Paused;

        emit LevelStateChanged(_programId, _levelId, LevelState.Paused);
    }

    /**
     * @notice Unpauses a program
     *
     * @param _programId id of the program
     * @param _levelId id of the program level
     */
    function unpauseProgramLevel(uint256 _programId, uint256 _levelId)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        Program storage _program = _programs[_programId];
        Level storage _level = _program.levels[_levelId];

        require(
            _level.state == LevelState.Paused,
            "LearnAndEarn::unpauseProgram: Invalid program level id"
        );

        _level.state = LevelState.Valid;

        emit LevelStateChanged(_programId, _levelId, LevelState.Valid);
    }

    /**
     * @notice Cancels a program level
     *
     * @param _programId id of the program
     * @param _levelId id of the program level
     * @param _fundRecipient the address of the recipient who will receive the funds allocated for this program
     */
    function cancelProgramLevel(
        uint256 _programId,
        uint256 _levelId,
        address _fundRecipient
    ) external override onlyOwnerOrImpactMarketCouncil {
        Program storage _program = _programs[_programId];
        Level storage _level = _program.levels[_levelId];

        require(
            _level.state == LevelState.Valid || _level.state == LevelState.Paused,
            "LearnAndEarn::cancelProgram: Invalid program level id"
        );

        _level.state = LevelState.Canceled;
        uint256 _levelBalance = _level.balance;
        _level.balance = 0;

        _program.token.safeTransfer(_fundRecipient, _levelBalance);

        emit LevelStateChanged(_programId, _levelId, LevelState.Canceled);
    }

    /**
     * @notice Allows beneficiaries to claim the reward for a list of levels using a signature
     *
     * @param _beneficiary     address of the beneficiary to be rewarded
     * @param _programId       the id of the program
     * @param _levelIds        the ids of the levels
     * @param _rewardAmounts   the amounts of the program tokens to be send to the beneficiary as reward for each levels
     * @param _signatures      the signatures from the backend
     */
    function claimRewardForLevels(
        address _beneficiary,
        uint256 _programId,
        uint256[] calldata _levelIds,
        uint256[] calldata _rewardAmounts,
        bytes[] calldata _signatures
    ) external override {
        Program storage _program = _programs[_programId];
        Level storage _level;

        require(
            _levelIds.length == _rewardAmounts.length && _levelIds.length == _signatures.length,
            "LearnAndEarn::claimRewardForLevels: Invalid data"
        );

        uint256 _index;
        bytes32 _messageHash;

        for (_index = 0; _index < _levelIds.length; _index++) {
            _level = _program.levels[_levelIds[_index]];

            require(
                _level.state == LevelState.Valid,
                "LearnAndEarn::claimRewardForLevels: Invalid program level id"
            );

            //if the beneficiary has already claimed the reward for this level,
            // or if the rewardAmount is 0
            //we skip this level
            if (_level.claims[_beneficiary] > 0 || _rewardAmounts[_index] == 0) {
                continue;
            }

            _messageHash = keccak256(
                abi.encodePacked(
                    _beneficiary,
                    _programId,
                    _levelIds[_index],
                    _rewardAmounts[_index]
                )
            );

            require(
                signerWalletAddress ==
                    _messageHash.toEthSignedMessageHash().recover(_signatures[_index]),
                "LearnAndEarn::claimRewardForLevels: Invalid signature"
            );

            _level.claims[_beneficiary] = _rewardAmounts[_index];

            require(
                _level.balance >= _rewardAmounts[_index],
                "LearnAndEarn::claimRewardForLevels: Program level doesn't have enough funds"
            );

            _program.token.safeTransfer(_beneficiary, _rewardAmounts[_index]);
            _level.balance -= _rewardAmounts[_index];

            emit RewardClaimed(_beneficiary, _programId, _levelIds[_index]);
        }
    }
}
