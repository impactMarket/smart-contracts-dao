//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/PACTDelegateStorageV1.sol";
import "./interfaces/PACTEvents.sol";

contract PACTDelegate is
    PACTEvents,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PACTDelegateStorageV1
{
    using SafeERC20 for IERC20;

    /// @notice The name of this contract
    string public constant NAME = "PACT";

    /// @notice The minimum setable proposal threshold
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 100_000_000e18; // 100,000,000 Tokens

    /// @notice The maximum setable proposal threshold
    uint256 public constant MAX_PROPOSAL_THRESHOLD = 500_000_000e18; // 500,000,000 Tokens

    /// @notice The minimum setable voting period
    uint256 public constant MIN_VOTING_PERIOD = 720; // About 1 hour

    /// @notice The max setable voting period
    uint256 public constant MAX_VOTING_PERIOD = 241920; // About 2 weeks

    /// @notice The min setable voting delay
    uint256 public constant MIN_VOTING_DELAY = 1;

    /// @notice The max setable voting delay
    uint256 public constant MAX_VOTING_DELAY = 120960; // About 1 week

    /// @notice The maximum number of actions that can be included in a proposal
    uint256 public constant PROPOSAL_MAX_OPERATIONS = 10; // 10 actions

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the ballot struct used by the contract
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");

    /**
     * @notice Used to initialize the contract during delegator constructor
     * @param _timelock The address of the Timelock
     * @param _token The address of the voting token
     * @param _releaseToken The address of the "Release" voting token. If none, specify the zero address.
     * @param _votingPeriod The initial voting period
     * @param _votingDelay The initial voting delay
     * @param _proposalThreshold The initial proposal threshold
     * @param _quorumVotes The initial quorum votes
     */
    function initialize(
        address _timelock,
        address _token,
        address _releaseToken,
        uint256 _votingPeriod,
        uint256 _votingDelay,
        uint256 _proposalThreshold,
        uint256 _quorumVotes
    ) public initializer {
        require(
            TimelockInterface(_timelock).admin() == address(this),
            "PACT::initialize: timelock admin is not assigned to PACTDelegate"
        );
        require(
            _votingPeriod >= MIN_VOTING_PERIOD && _votingPeriod <= MAX_VOTING_PERIOD,
            "PACT::initialize: invalid voting period"
        );
        require(
            _votingDelay >= MIN_VOTING_DELAY && _votingDelay <= MAX_VOTING_DELAY,
            "PACT::initialize: invalid voting delay"
        );
        require(
            _proposalThreshold >= MIN_PROPOSAL_THRESHOLD &&
                _proposalThreshold <= MAX_PROPOSAL_THRESHOLD,
            "PACT::initialize: invalid proposal threshold"
        );
        require(_quorumVotes >= _proposalThreshold, "PACT::initialize: invalid quorum votes");
        timelock = TimelockInterface(_timelock);
        require(_token != address(0), "PACT::initialize: invalid _token address");

        __Ownable_init();
        __ReentrancyGuard_init();

        transferOwnership(_timelock);

        token = IHasVotes(_token);
        releaseToken = IHasVotes(_releaseToken);
        votingPeriod = _votingPeriod;
        votingDelay = _votingDelay;
        proposalThreshold = _proposalThreshold;
        quorumVotes = _quorumVotes;

        // Create dummy proposal
        Proposal memory _dummyProposal = Proposal({
            id: proposalCount,
            proposer: address(this),
            eta: 0,
            startBlock: 0,
            endBlock: 0,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            canceled: true,
            executed: false
        });
        proposalCount++;

        proposals[_dummyProposal.id] = _dummyProposal;
        latestProposalIds[_dummyProposal.proposer] = _dummyProposal.id;

        emit ProposalCreated(
            _dummyProposal.id,
            address(this),
            proposalTargets[_dummyProposal.id],
            proposalValues[_dummyProposal.id],
            proposalSignatures[_dummyProposal.id],
            proposalCalldatas[_dummyProposal.id],
            0,
            0,
            ""
        );
    }

    /**
     * @notice Function used to propose a new proposal. Sender must have delegates above the proposal threshold.
     * @param _targets Target addresses for proposal calls.
     * @param _values Eth values for proposal calls.
     * @param _signatures Function signatures for proposal calls.
     * @param _calldatas Calldatas for proposal calls.
     * @param _description String description of the proposal.
     * @return Proposal id of new proposal.
     */
    function propose(
        address[] memory _targets,
        uint256[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) public returns (uint256) {
        require(
            getPriorVotes(msg.sender, sub256(block.number, 1)) > proposalThreshold,
            "PACT::propose: proposer votes below proposal threshold"
        );
        require(
            _targets.length == _values.length &&
                _targets.length == _signatures.length &&
                _targets.length == _calldatas.length,
            "PACT::propose: proposal function information arity mismatch"
        );
        require(_targets.length != 0, "PACT::propose: must provide actions");
        require(_targets.length <= PROPOSAL_MAX_OPERATIONS, "PACT::propose: too many actions");

        uint256 _latestProposalId = latestProposalIds[msg.sender];
        if (_latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(_latestProposalId);
            require(
                proposersLatestProposalState != ProposalState.Active,
                "PACT::propose: one live proposal per proposer, found an already active proposal"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "PACT::propose: one live proposal per proposer, found an already pending proposal"
            );
        }

        uint256 _startBlock = add256(block.number, votingDelay);
        uint256 _endBlock = add256(_startBlock, votingPeriod);

        Proposal memory _newProposal = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            eta: 0,
            startBlock: _startBlock,
            endBlock: _endBlock,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            canceled: false,
            executed: false
        });
        proposalCount++;

        proposals[_newProposal.id] = _newProposal;
        proposalTargets[_newProposal.id] = _targets;
        proposalValues[_newProposal.id] = _values;
        proposalSignatures[_newProposal.id] = _signatures;
        proposalCalldatas[_newProposal.id] = _calldatas;
        latestProposalIds[_newProposal.proposer] = _newProposal.id;

        emit ProposalCreated(
            _newProposal.id,
            msg.sender,
            _targets,
            _values,
            _signatures,
            _calldatas,
            _startBlock,
            _endBlock,
            _description
        );
        return _newProposal.id;
    }

    /**
     * @notice Queues a proposal of state succeeded
     * @param _proposalId The id of the proposal to queue
     */
    function queue(uint256 _proposalId) external {
        require(
            state(_proposalId) == ProposalState.Succeeded,
            "PACT::queue: proposal can only be queued if it is succeeded"
        );
        Proposal storage _proposal = proposals[_proposalId];
        uint256 _eta = add256(block.timestamp, timelock.delay());
        uint256 _i;
        uint256 _numberOfActions = proposalTargets[_proposalId].length;
        for (; _i < _numberOfActions; _i++) {
            queueOrRevertInternal(
                proposalTargets[_proposalId][_i],
                proposalValues[_proposalId][_i],
                proposalSignatures[_proposalId][_i],
                proposalCalldatas[_proposalId][_i],
                _eta
            );
        }
        _proposal.eta = _eta;
        emit ProposalQueued(_proposalId, _eta);
    }

    function queueOrRevertInternal(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(_target, _value, _signature, _data, _eta))
            ),
            "PACT::queueOrRevertInternal: identical proposal action already queued at eta"
        );
        timelock.queueTransaction(_target, _value, _signature, _data, _eta);
    }

    /**
     * @notice Executes a queued proposal if eta has passed
     * @param _proposalId The id of the proposal to execute
     */
    function execute(uint256 _proposalId) external payable {
        require(
            state(_proposalId) == ProposalState.Queued,
            "PACT::execute: proposal can only be executed if it is queued"
        );
        Proposal storage _proposal = proposals[_proposalId];
        _proposal.executed = true;
        uint256 _i;
        uint256 _numberOfActions = proposalTargets[_proposalId].length;
        for (; _i < _numberOfActions; _i++) {
            timelock.executeTransaction{value: proposalValues[_proposalId][_i]}(
                proposalTargets[_proposalId][_i],
                proposalValues[_proposalId][_i],
                proposalSignatures[_proposalId][_i],
                proposalCalldatas[_proposalId][_i],
                _proposal.eta
            );
        }
        emit ProposalExecuted(_proposalId);
    }

    /**
     * @notice Cancels a proposal only if sender is the proposer, or proposer delegates dropped below proposal threshold
     * @param _proposalId The id of the proposal to cancel
     */
    function cancel(uint256 _proposalId) external {
        require(
            state(_proposalId) != ProposalState.Executed,
            "PACT::cancel: cannot cancel executed proposal"
        );

        Proposal storage _proposal = proposals[_proposalId];
        require(
            msg.sender == _proposal.proposer ||
                getPriorVotes(_proposal.proposer, sub256(block.number, 1)) < proposalThreshold,
            "PACT::cancel: proposer above threshold"
        );

        _proposal.canceled = true;
        uint256 _i;
        uint256 _numberOfActions = proposalTargets[_proposalId].length;
        for (; _i < _numberOfActions; _i++) {
            timelock.cancelTransaction(
                proposalTargets[_proposalId][_i],
                proposalValues[_proposalId][_i],
                proposalSignatures[_proposalId][_i],
                proposalCalldatas[_proposalId][_i],
                _proposal.eta
            );
        }

        emit ProposalCanceled(_proposalId);
    }

    /**
     * @notice Gets actions of a proposal.
     * @param _proposalId Proposal to query.
     * @return targets Target addresses for proposal calls.
     * @return values Eth values for proposal calls.
     * @return signatures Function signatures for proposal calls.
     * @return calldatas Calldatas for proposal calls.
     */
    function getActions(uint256 _proposalId)
        external
        view
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        return (
            proposalTargets[_proposalId],
            proposalValues[_proposalId],
            proposalSignatures[_proposalId],
            proposalCalldatas[_proposalId]
        );
    }

    /**
     * @notice Gets the receipt for a voter on a given proposal
     * @param _proposalId the id of proposal
     * @param _voter The address of the voter
     * @return The voting receipt
     */
    function getReceipt(uint256 _proposalId, address _voter)
        external
        view
        returns (Receipt memory)
    {
        return proposalReceipts[_proposalId][_voter];
    }

    /**
     * @notice Gets the state of a proposal
     * @param _proposalId The id of the proposal
     * @return Proposal state
     */
    function state(uint256 _proposalId) public view returns (ProposalState) {
        require(proposalCount > _proposalId, "PACT::state: invalid proposal id");
        Proposal storage _proposal = proposals[_proposalId];

        if (_proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number <= _proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= _proposal.endBlock) {
            return ProposalState.Active;
        } else if (
            _proposal.forVotes <= _proposal.againstVotes || _proposal.forVotes < quorumVotes
        ) {
            return ProposalState.Defeated;
        } else if (_proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (_proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= add256(_proposal.eta, timelock.GRACE_PERIOD())) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
    }

    /**
     * @notice Cast a vote for a proposal
     * @param _proposalId The id of the proposal to vote on
     * @param _support The support value for the vote. 0=against, 1=for, 2=abstain
     */
    function castVote(uint256 _proposalId, uint8 _support) external {
        emit VoteCast(
            msg.sender,
            _proposalId,
            _support,
            castVoteInternal(msg.sender, _proposalId, _support),
            ""
        );
    }

    /**
     * @notice Cast a vote for a proposal with a reason
     * @param _proposalId The id of the proposal to vote on
     * @param _support The support value for the vote. 0=against, 1=for, 2=abstain
     * @param _reason The reason given for the vote by the voter
     */
    function castVoteWithReason(
        uint256 _proposalId,
        uint8 _support,
        string calldata _reason
    ) external {
        emit VoteCast(
            msg.sender,
            _proposalId,
            _support,
            castVoteInternal(msg.sender, _proposalId, _support),
            _reason
        );
    }

    /**
     * @notice Cast a vote for a proposal by signature
     * @dev External function that accepts EIP-712 signatures for voting on proposals.
     */
    function castVoteBySig(
        uint256 _proposalId,
        uint8 _support,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        require(_v == 27 || _v == 28, "PACT::castVoteBySig: invalid v value");
        require(
            _s < 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A1,
            "PACT::castVoteBySig: invalid s value"
        );
        bytes32 _domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), getChainIdInternal(), address(this))
        );
        bytes32 _structHash = keccak256(abi.encode(BALLOT_TYPEHASH, _proposalId, _support));
        bytes32 _digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator, _structHash));
        address _signatory = ecrecover(_digest, _v, _r, _s);
        require(_signatory != address(0), "PACT::castVoteBySig: invalid signature");
        emit VoteCast(
            _signatory,
            _proposalId,
            _support,
            castVoteInternal(_signatory, _proposalId, _support),
            ""
        );
    }

    /**
     * @notice Internal function that caries out voting logic
     * @param _voter The voter that is casting their vote
     * @param _proposalId The id of the proposal to vote on
     * @param _support The support value for the vote. 0=against, 1=for, 2=abstain
     * @return The number of votes cast
     */
    function castVoteInternal(
        address _voter,
        uint256 _proposalId,
        uint8 _support
    ) internal returns (uint96) {
        require(
            state(_proposalId) == ProposalState.Active,
            "PACT::castVoteInternal: voting is closed"
        );
        require(_support <= 2, "PACT::castVoteInternal: invalid vote type");
        Proposal storage _proposal = proposals[_proposalId];
        Receipt storage _receipt = proposalReceipts[_proposalId][_voter];
        require(!_receipt.hasVoted, "PACT::castVoteInternal: voter already voted");
        uint96 _votes = getPriorVotes(_voter, _proposal.startBlock);

        if (_support == 0) {
            _proposal.againstVotes = add256(_proposal.againstVotes, _votes);
        } else if (_support == 1) {
            _proposal.forVotes = add256(_proposal.forVotes, _votes);
        } else if (_support == 2) {
            _proposal.abstainVotes = add256(_proposal.abstainVotes, _votes);
        }

        _receipt.hasVoted = true;
        _receipt.support = _support;
        _receipt.votes = _votes;

        return _votes;
    }

    /**
     * @notice Owner function for setting the voting delay
     * @param _newVotingDelay new voting delay, in blocks
     */
    function _setVotingDelay(uint256 _newVotingDelay) external virtual onlyOwner {
        require(
            _newVotingDelay >= MIN_VOTING_DELAY && _newVotingDelay <= MAX_VOTING_DELAY,
            "PACT::_setVotingDelay: invalid voting delay"
        );
        uint256 _oldVotingDelay = votingDelay;
        votingDelay = _newVotingDelay;

        emit VotingDelaySet(_oldVotingDelay, _newVotingDelay);
    }

    /**
     * @notice Owner function for setting the quorum votes
     * @param _newQuorumVotes new quorum votes
     */
    function _setQuorumVotes(uint256 _newQuorumVotes) external onlyOwner {
        require(
            _newQuorumVotes >= proposalThreshold,
            "PACT::_setQuorumVotes: invalid quorum votes"
        );

        emit QuorumVotesSet(quorumVotes, _newQuorumVotes);
        quorumVotes = _newQuorumVotes;
    }

    /**
     * @notice Owner function for setting the voting period
     * @param _newVotingPeriod new voting period, in blocks
     */
    function _setVotingPeriod(uint256 _newVotingPeriod) external virtual onlyOwner {
        require(
            _newVotingPeriod >= MIN_VOTING_PERIOD && _newVotingPeriod <= MAX_VOTING_PERIOD,
            "PACT::_setVotingPeriod: invalid voting period"
        );
        emit VotingPeriodSet(votingPeriod, _newVotingPeriod);
        votingPeriod = _newVotingPeriod;
    }

    /**
     * @notice Owner function for setting the proposal threshold
     * @dev _newProposalThreshold must be greater than the hardcoded min
     * @param _newProposalThreshold new proposal threshold
     */
    function _setProposalThreshold(uint256 _newProposalThreshold) external onlyOwner {
        require(
            _newProposalThreshold >= MIN_PROPOSAL_THRESHOLD &&
                _newProposalThreshold <= MAX_PROPOSAL_THRESHOLD,
            "PACT::_setProposalThreshold: invalid proposal threshold"
        );
        emit ProposalThresholdSet(proposalThreshold, _newProposalThreshold);
        proposalThreshold = _newProposalThreshold;
    }

    /**
     * @notice Owner function for setting the release token
     * @param _newReleaseToken new release token address
     */
    function _setReleaseToken(IHasVotes _newReleaseToken) external onlyOwner {
        require(
            _newReleaseToken != token,
            "PACT::_setReleaseToken: releaseToken and token must be different"
        );
        emit ReleaseTokenSet(address(releaseToken), address(_newReleaseToken));
        releaseToken = _newReleaseToken;
    }

    function getPriorVotes(address _voter, uint256 _beforeBlock) public view returns (uint96) {
        if (address(releaseToken) == address(0)) {
            return token.getPriorVotes(_voter, _beforeBlock);
        }
        return
            add96(
                token.getPriorVotes(_voter, _beforeBlock),
                releaseToken.getPriorVotes(_voter, _beforeBlock),
                "getPriorVotes overflow"
            );
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
    ) external onlyOwner nonReentrant {
        _token.safeTransfer(_to, _amount);

        emit TransferERC20(address(_token), _to, _amount);
    }

    function add256(uint256 _a, uint256 _b) internal pure returns (uint256) {
        uint256 _c = _a + _b;
        require(_c >= _a, "addition overflow");
        return _c;
    }

    function sub256(uint256 _a, uint256 _b) internal pure returns (uint256) {
        require(_b <= _a, "subtraction underflow");
        return _a - _b;
    }

    function getChainIdInternal() internal view returns (uint256) {
        uint256 _chainId;
        assembly {
            _chainId := chainid()
        }
        return _chainId;
    }

    function add96(
        uint96 _a,
        uint96 _b,
        string memory _errorMessage
    ) internal pure returns (uint96) {
        uint96 _c = _a + _b;
        require(_c >= _a, _errorMessage);
        return _c;
    }
}
