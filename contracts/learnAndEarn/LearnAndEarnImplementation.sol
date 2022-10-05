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
    using SafeERC20Upgradeable for IERC202;
    using EnumerableSet for EnumerableSet.UintSet;
    using ECDSA for bytes32;

    /**
     * @notice Triggered when a program has been funded
     *
     * @param programId         Id of the program
     * @param sender            Address of the sender
     * @param amount            Amount of the fund
     */
    event ProgramFunded(uint256 indexed programId, address indexed sender, uint256 amount);

    /**
     * @notice Triggered when a program state has been changed
     *
     * @param programId         Id of the program
     * @param state             New state of the program
     */
    event ProgramStateChanged(uint256 indexed programId, ProgramState indexed state);

    /**
     * @notice Triggered when a reward has been claimed
     *
     * @param beneficiary    address of the beneficiary to be rewarded
     * @param programId      the id of the program
     * @param courseId       the id of the course
     */
    event RewardClaimed(
        address indexed beneficiary,
        uint256 indexed programId,
        uint256 indexed courseId
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

    function programs(uint256 _id)
        external
        view
        override
        returns (
            IERC202 token,
            uint256 balance,
            ProgramState state
        )
    {
        Program storage _program = _programs[_id];
        token = _program.token;
        balance = _program.balance;
        state = _program.state;
    }

    /**
     * @notice Returns the length of the programList
     */
    function programListLength() external view override returns (uint256) {
        return _programList.length();
    }

    /**
     * @notice Returns an id from the programList
     *
     * @param _index index value
     * @return id of the program
     */
    function programListAt(uint256 _index) external view override returns (uint256) {
        return _programList.at(_index);
    }

    /**
     * @notice Returns the reward amount claimed by a beneficiary for a course
     *
     * @param _programId id of the program
     * @param _courseId id of the course
     * @param _beneficiary address of the beneficiary
     * @return id reward amount claimed by the beneficiary for a course
     */
    function programCourseClaimAmount(
        uint256 _programId,
        uint256 _courseId,
        address _beneficiary
    ) external view override returns (uint256) {
        return _programs[_programId].courseClaims[_courseId][_beneficiary];
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
     * @param _id the id of the program
     * @param _token the token used for reward
     */
    function addProgram(uint256 _id, IERC202 _token)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        require(!_programList.contains(_id), "LearnAndEarn::addProgram: Program id must be unique");

        _programList.add(_id);
        Program storage _program = _programs[_id];
        _program.token = _token;
        _program.state = ProgramState.Valid;

        emit ProgramStateChanged(_id, ProgramState.Valid);
    }

    /**
     * @notice Funds new program
     *
     * @param _programId the id of the program
     * @param _amount the amount to be funded
     */
    function fundProgram(uint256 _programId, uint256 _amount) external override {
        Program storage _program = _programs[_programId];

        require(
            _program.state == ProgramState.Valid || _program.state == ProgramState.Paused,
            "LearnAndEarn::fundProgram: This program cannot be funded"
        );

        _program.token.safeTransferFrom(msg.sender, address(this), _amount);

        _program.balance += _amount;

        emit ProgramFunded(_programId, msg.sender, _amount);
    }

    /**
     * @notice Pauses a program
     *
     * @param _id id of the program
     */
    function pauseProgram(uint256 _id) external override onlyOwnerOrImpactMarketCouncil {
        Program storage _program = _programs[_id];

        require(
            _program.state == ProgramState.Valid,
            "LearnAndEarn::pauseProgram: Program must be valid"
        );

        _program.state = ProgramState.Paused;

        emit ProgramStateChanged(_id, ProgramState.Paused);
    }

    /**
     * @notice Unpauses a program
     *
     * @param _id id of the program
     */
    function unpauseProgram(uint256 _id) external override onlyOwnerOrImpactMarketCouncil {
        Program storage _program = _programs[_id];

        require(
            _program.state == ProgramState.Paused,
            "LearnAndEarn::pauseProgram: Program must be paused"
        );

        _program.state = ProgramState.Valid;

        emit ProgramStateChanged(_id, ProgramState.Valid);
    }

    /**
     * @notice Cancels a program
     *
     * @param _id the id of the program
     * @param _fundRecipient the address of the recipient who will receive the funds allocated for this program
     */
    function cancelProgram(uint256 _id, address _fundRecipient)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        Program storage _program = _programs[_id];

        require(
            _program.state == ProgramState.Valid || _program.state == ProgramState.Paused,
            "LearnAndEarn::cancelProgram: This program cannot be canceld"
        );
        _program.state = ProgramState.Canceled;
        uint256 _programBalance = _program.balance;
        _program.balance = 0;

        _program.token.safeTransfer(_fundRecipient, _programBalance);

        emit ProgramStateChanged(_id, ProgramState.Canceled);
    }

    /**
     * @notice Allows beneficiaries to claim the reward for a course using a signature
     *
     * @param _beneficiary     address of the beneficiary to be rewarded
     * @param _programId       the id of the program
     * @param _courseIds       the ids of the courses
     * @param _rewardAmounts   the amounts of the program tokens to be send to the beneficiary as reward for each courses
     * @param _signatures      the signatures from the backend
     */
    function claimRewardForCourses(
        address _beneficiary,
        uint256 _programId,
        uint256[] calldata _courseIds,
        uint256[] calldata _rewardAmounts,
        bytes[] calldata _signatures
    ) external override {
        Program storage _program = _programs[_programId];

        require(
            _program.state == ProgramState.Valid,
            "LearnAndEarn::claimReward: Program is not valid"
        );

        require(
            _courseIds.length == _rewardAmounts.length && _courseIds.length == _signatures.length,
            "LearnAndEarn::claimReward: Invalid data"
        );

        uint256 _index;
        uint256 _totalRewardAmount;
        bytes32 _messageHash;

        for (_index = 0; _index < _courseIds.length; _index++) {
            //if the beneficiary has already claimed the reward for this course,
            //we skip this course from the current reward amount
            if (_program.courseClaims[_courseIds[_index]][_beneficiary] > 0) {
                continue;
            }

            _messageHash = keccak256(
                abi.encodePacked(
                    _beneficiary,
                    _programId,
                    _courseIds[_index],
                    _rewardAmounts[_index]
                )
            );

            require(
                signerWalletAddress ==
                    _messageHash.toEthSignedMessageHash().recover(_signatures[_index]),
                "LearnAndEarn::claimReward: Invalid signature"
            );

            _program.courseClaims[_courseIds[_index]][_beneficiary] = _rewardAmounts[_index];
            _totalRewardAmount += _rewardAmounts[_index];

            emit RewardClaimed(_beneficiary, _programId, _courseIds[_index]);
        }

        if (_totalRewardAmount > 0) {
            require(
                _program.balance >= _totalRewardAmount,
                "LearnAndEarn::claimReward: Program doesn't have enough funds"
            );

            _program.token.safeTransfer(_beneficiary, _totalRewardAmount);
            _program.balance -= _totalRewardAmount;
        }
    }
}
