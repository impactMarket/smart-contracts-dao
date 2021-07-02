pragma solidity 0.8.5;

import "../community/interfaces/ICommunityFactory.sol";

import "hardhat/console.sol";

contract IPCTGovernor {
    /// @notice The name of this contract
    string public constant name = "Impact Market Governor";

    /// @notice Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Executed
    }

    enum ProposalType {
        ByHolder,
        ByAdmin
    }

    struct CallParams {
        address target;
        uint value;
        string signature;
        bytes data;
    }

    struct Proposal {
        /// @notice Unique id for looking up a proposal
        uint id;

        ProposalType proposalType;

        CallParams callParams;

        /// @notice Creator of the proposal
        address proposer;

        /// @notice The block at which voting begins: holders must delegate their votes prior to this block
        uint startBlock;

        /// @notice The block at which voting ends: votes must be cast prior to this block
        uint endBlock;

        /// @notice Current number of votes in favor of this proposal
        uint forVotes;

        /// @notice Current number of votes in opposition to this proposal
        uint againstVotes;

        /// @notice Flag marking whether the proposal has been canceled
        bool canceled;

        /// @notice Flag marking whether the proposal has been executed
        bool executed;

        /// @notice Receipts of ballots for the entire set of voters
        mapping (address => Receipt) receipts;

        mapping (address => bool) signatures;
        uint signaturesCount;
    }

    /// @notice Ballot receipt record for a voter
    struct Receipt {
        /// @notice Whether or not a vote has been cast
        bool hasVoted;

        /// @notice Whether or not the voter supports the proposal
        bool support;

        /// @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

    uint public constant MINIMUM_DELAY = 2 days;
    uint public constant MAXIMUM_DELAY = 30 days;

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint public quorumVotes = 2_500_000e18; // 2.5% of IPCT

    /// @notice The number of votes required in order for a voter to become a proposer
    uint public proposalThreshold = 1_000_000e18; // 1% of IPCT

    /// @notice The delay before voting on a proposal may take place, once proposed
    //    uint public votingDelay = 13140; // ~2 days in blocks (assuming 15s blocks)
    uint public votingDelay = 10;

    /// @notice The duration of voting on a proposal, in blocks
    //    uint public votingPeriod = 40_320; // ~7 days in blocks (assuming 15s blocks)
    uint public votingPeriod = 20; // ~7 days in blocks (assuming 15s blocks)

    uint public delay = 172800;

    /// @notice The address of the IPCT governance token
    IPCTInterface public ipct;

    /// @notice The total number of proposals
    uint public proposalCount;

    address[] public admins;

    uint public signaturesThreshold;

    mapping (address => bool) public isAdmin;

    /// @notice The official record of all proposals ever proposed
    mapping (uint => Proposal) public proposals;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the ballot struct used by the contract
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(uint id, address proposer, uint startBlock, uint endBlock, string description);

    /// @notice An event emitted when a vote has been cast on a proposal
    event VoteCast(address voter, uint proposalId, bool support, uint votes);

    /// @notice An event emitted when a proposal has been canceled
    event ProposalCanceled(uint id);

    /// @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint id);

    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "NOT_ADMIN");
        _;
    }

    /**
     * @notice Construct a new IPCTGovernor contract
     * @param _admins - contract admins
     * @param _signaturesThreshold - number of admin that are required to sign a proposal in the initial phase
     * @param _ipct - address of ERC20 that claims will be distributed from
     **/
    constructor(address _ipct, address[] memory _admins, uint _signaturesThreshold) public {
        require (_admins.length >= _signaturesThreshold,
            "IPCTGovernor::constructor: signaturesThreshold must be lower than total number of admins");

        ipct = IPCTInterface(_ipct);
        _changeAdmins(_admins, _signaturesThreshold);
    }

    function updateGovernor(
        address[] memory _admins,
        uint _signaturesThreshold,
        address _ipct,
        uint _delay,
        uint _quorumVotes,
        uint _proposalThreshold,
        uint _votingDelay,
        uint _votingPeriod,
        string memory _description
    ) public {
        require(_delay >= MINIMUM_DELAY, "IPCTGovernor::updateGovernor: Delay must exceed minimum delay.");
        require(_delay <= MAXIMUM_DELAY, "IPCTGovernor::updateGovernor: Delay must not exceed maximum delay.");

        require (_admins.length >= _signaturesThreshold,
            "IPCTGovernor::proposeUpdateGovernor: signaturesThreshold must be lower than total number of admins");

        ipct = IPCTInterface(_ipct);
        delay = _delay;
        quorumVotes = _quorumVotes;
        proposalThreshold = _proposalThreshold;
        votingDelay = _votingDelay;
        votingPeriod = _votingPeriod;
        _changeAdmins(_admins, _signaturesThreshold);
    }

    function propose(
        address _target,
        uint _value,
        string memory _signature,
        bytes memory _data,
        string memory _description
    ) external {
        uint proposalId = _createProposal(_target, _value, _signature, _data, _description, ProposalType.ByHolder);
    }

    function proposeByAdmin(
        address _target,
        uint _value,
        string memory _signature,
        bytes memory _data,
        string memory _description
    ) external onlyAdmin {
        uint proposalId = _createProposal(_target, _value, _signature, _data, _description, ProposalType.ByAdmin);
    }

    function _createProposal(
        address _target,
        uint _value,
        string memory _signature,
        bytes memory _data,
        string memory _description,
        ProposalType _proposalType
    ) internal returns (uint) {
        require(ipct.getPriorVotes(msg.sender, block.number - 1) > proposalThreshold,
            "IPCTGovernor::propose: proposer votes below proposal threshold");

        uint startBlock = block.number + votingDelay;
        uint endBlock = startBlock + votingPeriod;

        proposalCount++;

        proposals[proposalCount].callParams.target = _target;
        proposals[proposalCount].callParams.value = _value;
        proposals[proposalCount].callParams.signature = _signature;
        proposals[proposalCount].callParams.data = _data;

        proposals[proposalCount].id = proposalCount;
        proposals[proposalCount].proposalType = _proposalType;
        proposals[proposalCount].proposer = msg.sender;
        proposals[proposalCount].startBlock = startBlock;
        proposals[proposalCount].endBlock = endBlock;
//        proposals[proposalCount].forVotes = 0;
//        proposals[proposalCount].againstVotes = 0;
//        proposals[proposalCount].canceled = false;
//        proposals[proposalCount].executed = false;

        emit ProposalCreated(proposalCount, msg.sender, startBlock, endBlock, _description);
        return proposalCount;
    }

    function execute(uint proposalId) public payable {
        require(state(proposalId) == ProposalState.Succeeded,
            "IPCTGovernor::execute: proposal can only be executed if it is succeeded");

        bytes memory callData;

        if (bytes(proposals[proposalId].callParams.signature).length == 0) {
            callData = proposals[proposalId].callParams.data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(proposals[proposalId].callParams.signature))), proposals[proposalId].callParams.data);
        }

        proposals[proposalId].callParams.target.call(callData);

        proposals[proposalId].executed = true;

        emit ProposalExecuted(proposalId);
    }

    function executeByAdmin(uint proposalId) public payable onlyAdmin {
        ProposalState proposalState = state(proposalId);
        require(proposalState == ProposalState.Pending || proposalState == ProposalState.Active,
            "IPCTGovernor::executeByAdmin: proposal can only be executed if it is pending or active");
        require(proposals[proposalId].signaturesCount >= signaturesThreshold, "IPCTGovernor::executeByAdmin: proposal doesn't have enough signatures");

        bytes memory callData;

        if (bytes(proposals[proposalId].callParams.signature).length == 0) {
            callData = proposals[proposalId].callParams.data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(proposals[proposalId].callParams.signature))), proposals[proposalId].callParams.data);
        }

        proposals[proposalId].callParams.target.call(callData);

        proposals[proposalId].executed = true;

        emit ProposalExecuted(proposalId);
    }

    function cancel(uint proposalId) public {
        ProposalState state = state(proposalId);
        require(state != ProposalState.Executed, "IPCTGovernor::cancel: cannot cancel executed proposal");

        Proposal storage proposal = proposals[proposalId];
        require(ipct.getPriorVotes(proposal.proposer, block.number - 1) < proposalThreshold, "IPCTGovernor::cancel: proposer above threshold");

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    function getReceipt(uint proposalId, address voter) public view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

    function state(uint proposalId) public view returns (ProposalState) {
        require(proposalCount >= proposalId && proposalId > 0, "IPCTGovernor::state: invalid proposal id");
        Proposal storage proposal = proposals[proposalId];

        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes > proposal.againstVotes && proposal.forVotes >= quorumVotes) {
            return ProposalState.Succeeded;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes) {
            return ProposalState.Defeated;
        } else {
            revert("IPCTGovernor::state: invalid state");
        }
    }

    function signProposal(uint proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.signatures[msg.sender] == false, "IPCTGovernor::signProposal: You have already signed this proposal");
        proposal.signatures[msg.sender] = true;
        proposal.signaturesCount++;
    }

    function castVote(uint proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

    function castVoteBySig(uint proposalId, bool support, uint8 v, bytes32 r, bytes32 s) public {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "IPCTGovernor::castVoteBySig: invalid signature");
        return _castVote(signatory, proposalId, support);
    }

    function _castVote(address voter, uint proposalId, bool support) internal {
        require(state(proposalId) == ProposalState.Active, "IPCTGovernor::_castVote: voting is closed");
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        require(receipt.hasVoted == false, "IPCTGovernor::_castVote: voter already voted");
        uint96 votes = ipct.getPriorVotes(voter, proposal.startBlock);

        if (support) {
            proposal.forVotes = proposal.forVotes + votes;
        } else {
            proposal.againstVotes = proposal.againstVotes + votes;
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    function getChainId() internal view returns (uint) {
        uint chainId;
        assembly { chainId := chainid() }
        return chainId;
    }

    function _changeAdmins(address[] memory _newAdmins, uint _newSignaturesThreshold) internal {
        for (uint u = 0; u < admins.length; u += 1) {
            isAdmin[admins[u]] = false;
        }
        for (uint u = 0; u < _newAdmins.length; u += 1) {
            isAdmin[_newAdmins[u]] = true;
        }
        admins = _newAdmins;
        signaturesThreshold = _newSignaturesThreshold;
    }
}

interface IPCTInterface {
    function getPriorVotes(address account, uint blockNumber) external view returns (uint96);
}

interface ERC20Interface {
    function transferFrom(address from, address to, uint amount) external;
}
