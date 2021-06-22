pragma solidity 0.8.5;

import "hardhat/console.sol";

contract IPCTGovernor {
    /// @notice The name of this contract
    string public constant name = "Impact Market Governor";

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    function quorumVotes() public pure returns (uint) { return 2_500_000e18; } // 2.5% of IPCT

    /// @notice The number of votes required in order for a voter to become a proposer
    function proposalThreshold() public pure returns (uint) { return 1_000_000e18; } // 1% of IPCT

    /// @notice The delay before voting on a proposal may take place, once proposed
//    function votingDelay() public pure returns (uint) { return 13140; } // ~2 days in blocks (assuming 15s blocks)
    function votingDelay() public pure returns (uint) { return 10; } // ~2 days in blocks (assuming 15s blocks)

    /// @notice The duration of voting on a proposal, in blocks
//    function votingPeriod() public pure returns (uint) { return 40_320; } // ~7 days in blocks (assuming 15s blocks)
    function votingPeriod() public pure returns (uint) { return 20; } // ~7 days in blocks (assuming 15s blocks)

    struct Proposal {
        /// @notice Unique id for looking up a proposal
        uint id;

        /// @notice Creator of the proposal
        address proposer;

        /// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
        uint eta;

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

    struct ProposalChangeDaoParams {
        address admin;
        address ipct;
        uint delay;
    }

    struct ProposalSendMoneyParams {
        address token;
        address to;
        uint value;
    }

    /// @notice Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    enum ProposalType {
        ChangeDao,
        SendMoney,
        CreateCommunity,
        DeleteCommunity
    }

    uint public constant GRACE_PERIOD = 14 days;
    uint public constant MINIMUM_DELAY = 2 days;
    uint public constant MAXIMUM_DELAY = 30 days;

    /// @notice The address of the IPCT governance token
    IPCTInterface public ipct;

    /// @notice The total number of proposals
    uint public proposalCount;

    address public admin;

    uint public delay;

    /// @notice The official record of all proposals ever proposed
    mapping (uint => Proposal) public proposals;

    mapping (uint => ProposalChangeDaoParams) public proposalsChangeDaoParams;

    mapping (uint => ProposalSendMoneyParams) public proposalsSendMoneyParams;

    mapping (bytes32 => bool) public queuedTransactions;

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

    /// @notice An event emitted when a proposal has been queued in the Timelock
    event ProposalQueued(uint id, uint eta);

    /// @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint id);

    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint eta);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);

    /**
     * @notice Construct a new IPCTGovernor contract
     * @param admin_ - contract admin
     * @param ipct_ - address of ERC20 that claims will be distributed from
     * @param delay_ - delay before successful proposal
     **/
    constructor(address admin_, address ipct_, uint delay_) public {
        require(delay_ >= MINIMUM_DELAY, "IPCTGovernor::constructor: Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "IPCTGovernor::constructor: Delay must not exceed maximum delay.");

        ipct = IPCTInterface(ipct_);
        delay = delay_;
        admin = admin_;
    }

    function _createProposal(ProposalType _proposalType, string memory _description) internal returns (uint) {
        require(ipct.getPriorVotes(msg.sender, block.number - 1) > proposalThreshold(), "IPCTGovernor::propose: proposer votes below proposal threshold");

        uint startBlock = block.number + votingDelay();
        uint endBlock = startBlock + votingPeriod();

        proposalCount++;
        proposals[proposalCount].id = proposalCount;
        proposals[proposalCount].proposer = msg.sender;
        proposals[proposalCount].eta = 0;
        proposals[proposalCount].startBlock = startBlock;
        proposals[proposalCount].endBlock = endBlock;
        proposals[proposalCount].forVotes = 0;
        proposals[proposalCount].againstVotes = 0;
        proposals[proposalCount].canceled = false;
        proposals[proposalCount].executed = false;

        emit ProposalCreated(proposalCount, msg.sender, startBlock, endBlock, _description);
        return proposalCount;
    }

    function proposeSendMoney(address _token, address _to, uint _value, string memory _description) external {
        uint proposalId = _createProposal(ProposalType.SendMoney, _description);

        ProposalSendMoneyParams memory _params;
        _params.token = _token;
        _params.to = _to;
        _params.value = _value;

        proposalsSendMoneyParams[proposalId] = _params;
    }

    function queue(uint proposalId) public {
        require(state(proposalId) == ProposalState.Succeeded, "IPCTGovernor::queue: proposal can only be queued if it is succeeded");
        Proposal storage proposal = proposals[proposalId];
        proposal.eta = block.timestamp + delay;

        emit ProposalQueued(proposalId, proposal.eta);
    }

    function execute(uint proposalId) public payable {
        require(state(proposalId) == ProposalState.Queued, "IPCTGovernor::execute: proposal can only be executed if it is queued");
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }

    function cancel(uint proposalId) public {
        ProposalState state = state(proposalId);
        require(state != ProposalState.Executed, "IPCTGovernor::cancel: cannot cancel executed proposal");

        Proposal storage proposal = proposals[proposalId];
        require(ipct.getPriorVotes(proposal.proposer, block.number - 1) < proposalThreshold(), "IPCTGovernor::cancel: proposer above threshold");

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
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes()) {
            return ProposalState.Defeated;
        } else if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= proposal.eta + GRACE_PERIOD) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
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
}

interface IPCTInterface {
    function getPriorVotes(address account, uint blockNumber) external view returns (uint96);
}
