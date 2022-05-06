// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/UBICommitteeStorageV1.sol";

contract UBICommitteeImplementation is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UBICommitteeStorageV1
{
    /// @notice The max setable voting period
    uint256 public constant MAX_VOTING_PERIOD = 518400; // About 30 days

    /// @notice The maximum number of actions that can be included in a proposal
    uint256 public constant PROPOSAL_MAX_OPERATIONS = 10; // 10 actions

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(
        uint256 id,
        address proposer,
        string[] signatures,
        bytes[] calldatas,
        uint256 endBlock,
        string description
    );

    /// @notice An event emitted when a vote has been cast on a proposal
    /// @param voter The address which casted a vote
    /// @param proposalId The proposal id which was voted on
    /// @param support Support value for the vote. 0=against, 1=for, 2=abstain
    /// @param votes Number of votes which were cast by the voter
    /// @param reason The reason given for the vote by the voter
    event VoteCast(
        address indexed voter,
        uint256 proposalId,
        uint8 support,
        uint256 votes,
        string reason
    );

    /// @notice An event emitted when a proposal has been canceled
    event ProposalCanceled(uint256 id);

    /// @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint256 id);

    /// @notice Emitted when implementation is changed
    event NewImplementation(address oldImplementation, address newImplementation);

    /// @notice An event emitted when the quorum votes is set
    event QuorumVotesSet(uint256 oldQuorumVotes, uint256 newQuorumVotes);

    /// @notice An event emitted when a member is added
    event MemberAdded(address member);

    /// @notice An event emitted when a member is removed
    event MemberRemoved(address member);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    modifier onlyMember() {
        require(members[msg.sender] == true, "PACT:: Not a member");
        _;
    }

    /**
     * @notice Used to initialize the contract during delegator contructor
     * @param _quorumVotes The initial quorum votes
     */
    function initialize(
        uint256 _quorumVotes,
        ICommunityAdmin _communityAdmin,
        address[] calldata _members
    ) public initializer {
        require(_quorumVotes >= 1, "PACT::initialize: invalid proposal threshold");
        require(_quorumVotes <= _members.length, "PACT::initialize: params mismatch");

        __Ownable_init();
        __ReentrancyGuard_init();

        communityProxyAdmin = new ProxyAdmin();
        communityAdmin = _communityAdmin;
        quorumVotes = _quorumVotes;

        // Create dummy proposal
        Proposal memory _dummyProposal = Proposal({
            id: proposalCount,
            proposer: address(this),
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

        for (uint256 index = 0; index < _members.length; index++) {
            members[_members[index]] = true;
            emit MemberAdded(_members[index]);
        }

        emit ProposalCreated(
            _dummyProposal.id,
            address(this),
            proposalSignatures[_dummyProposal.id],
            proposalCalldatas[_dummyProposal.id],
            0,
            ""
        );
    }

    /**
     * @notice Function used to add new members to the committee.
     * @param _member Member address.
     */
    function addMember(address _member) external onlyOwner {
        require(members[_member] == false, "PACT::addMember: already a member");

        members[_member] = true;

        emit MemberAdded(_member);
    }

    /**
     * @notice Function used to remove members from the committee.
     * @param _member Member address.
     */
    function removeMember(address _member) external onlyOwner {
        require(members[_member] == true, "PACT::removeMember: not a member");

        members[_member] = false;

        emit MemberRemoved(_member);
    }

    /**
     * @notice Function used to propose a new proposal. Sender must have delegates above the proposal threshold.
     * @param _signatures Function signatures for proposal calls.
     * @param _calldatas Calldatas for proposal calls.
     * @param _description String description of the proposal.
     * @return Proposal id of new proposal.
     */
    function propose(
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external onlyMember returns (uint256) {
        require(
            _signatures.length == _calldatas.length,
            "PACT::propose: proposal function information arity mismatch"
        );
        require(_signatures.length != 0, "PACT::propose: must provide actions");
        require(_signatures.length <= PROPOSAL_MAX_OPERATIONS, "PACT::propose: too many actions");

        uint256 _endBlock = add256(block.number, MAX_VOTING_PERIOD); // (518400) 30 days

        Proposal memory _newProposal = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            endBlock: _endBlock,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            canceled: false,
            executed: false
        });
        proposalCount++;

        proposals[_newProposal.id] = _newProposal;
        proposalSignatures[_newProposal.id] = _signatures;
        proposalCalldatas[_newProposal.id] = _calldatas;
        latestProposalIds[_newProposal.proposer] = _newProposal.id;

        emit ProposalCreated(
            _newProposal.id,
            msg.sender,
            _signatures,
            _calldatas,
            _endBlock,
            _description
        );
        return _newProposal.id;
    }

    /**
     * @notice Executes a queued proposal if eta has passed
     * @param _proposalId The id of the proposal to execute
     */
    function execute(uint256 _proposalId) external onlyMember payable {
        require(
            state(_proposalId) == ProposalState.Succeeded,
            "PACT::execute: proposal can only be executed if it is succeeded"
        );
        Proposal storage _proposal = proposals[_proposalId];
        _proposal.executed = true;
        for (uint256 i = 0; i < proposalCalldatas[_proposalId].length; i++) {
            bytes memory _callData;
            if (bytes(proposalSignatures[_proposalId][i]).length == 0) {
                _callData = proposalCalldatas[_proposalId][i];
            } else {
                _callData = abi.encodePacked(
                    bytes4(keccak256(bytes(proposalSignatures[_proposalId][i]))),
                    proposalCalldatas[_proposalId][i]
                );
            }

            // solium-disable-next-line security/no-call-value
            (bool _success, ) = address(communityAdmin).call{value: 0}(_callData);
            require(_success, "PACT::execute: Transaction execution reverted.");
        }
        emit ProposalExecuted(_proposalId);
    }

    /**
     * @notice Cancels a proposal only if sender is the proposer, or proposer delegates dropped below proposal threshold
     * @param _proposalId The id of the proposal to cancel
     */
    function cancel(uint256 _proposalId) external onlyMember {
        require(
            state(_proposalId) != ProposalState.Executed,
            "PACT::cancel: cannot cancel executed proposal"
        );

        Proposal storage _proposal = proposals[_proposalId];
        require(msg.sender == _proposal.proposer, "PACT::cancel: proposer not allowed");

        _proposal.canceled = true;

        emit ProposalCanceled(_proposalId);
    }

    /**
     * @notice Gets actions of a proposal.
     * @param _proposalId Proposal to query.
     * @return signatures Function signatures for proposal calls.
     * @return calldatas Calldatas for proposal calls.
     */
    function getActions(uint256 _proposalId)
        external
        view
        returns (string[] memory signatures, bytes[] memory calldatas)
    {
        return (proposalSignatures[_proposalId], proposalCalldatas[_proposalId]);
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
        } else if (_proposal.executed) {
            return ProposalState.Executed;
        } else if (block.number > _proposal.endBlock) {
            return ProposalState.Expired;
        } else if (
            _proposal.forVotes > _proposal.againstVotes && _proposal.forVotes >= quorumVotes
        ) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Active;
        }
    }

    /**
     * @notice Cast a vote for a proposal
     * @param _proposalId The id of the proposal to vote on
     * @param _support The support value for the vote. 0=against, 1=for, 2=abstain
     */
    function castVote(uint256 _proposalId, uint8 _support) external onlyMember {
        emit VoteCast(
            msg.sender,
            _proposalId,
            _support,
            castVoteInternal(msg.sender, _proposalId, _support),
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
        require(_receipt.hasVoted == false, "PACT::castVoteInternal: voter already voted");
        uint96 _votes = 1;

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
     * @notice Owner function for setting the quorum votes
     * @param _newQuorumVotes new quorum votes
     */
    function setQuorumVotes(uint256 _newQuorumVotes) external onlyOwner {
        require(_newQuorumVotes >= 1, "PACT::_setQuorumVotes: invalid quorum votes");

        uint256 _oldQuorumVotes = quorumVotes;
        quorumVotes = _newQuorumVotes;

        emit QuorumVotesSet(_oldQuorumVotes, _newQuorumVotes);
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
