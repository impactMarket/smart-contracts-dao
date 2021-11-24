//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@ubeswap/governance/contracts/interfaces/IHasVotes.sol";
import "./IPCTDelegatorStorage.sol";
import "./TimelockInterface.sol";

/**
 * @title Storage for Governor Delegate
 * @notice For future upgrades, do not change IPCTDelegateStorageV1. Create a new
 * contract which implements IPCTDelegateStorageV1 and following the naming convention
 * IPCTDelegateStorageVX.
 */
contract IPCTDelegateStorageV1 is IPCTDelegatorStorage {
    /// @notice The delay before voting on a proposal may take place, once proposed, in blocks
    uint256 public votingDelay;

    /// @notice The duration of voting on a proposal, in blocks
    uint256 public votingPeriod;

    /// @notice The number of votes required in order for a voter to become a proposer
    uint256 public proposalThreshold;

    /// @notice The total number of proposals
    uint256 public proposalCount;

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public quorumVotes;

    /// @notice The address of the Governance Timelock
    TimelockInterface public timelock;

    /// @notice The address of the governance token
    IHasVotes public token;

    /// @notice The address of the "Release" governance token
    IHasVotes public releaseToken;

    /// @notice The official record of all proposals ever proposed
    mapping(uint256 => Proposal) public proposals;
    /// @notice The official each proposal's targets:
    /// An ordered list of target addresses for calls to be made
    mapping(uint256 => address[]) public proposalTargets;
    /// @notice The official each proposal's values:
    /// An ordered list of values (i.e. msg.value) to be passed to the calls to be made
    mapping(uint256 => uint256[]) public proposalValues;
    /// @notice The official each proposal's signatures:
    /// An ordered list of function signatures to be called
    mapping(uint256 => string[]) public proposalSignatures;
    /// @notice The official each proposal's calldatas:
    /// An ordered list of calldata to be passed to each call
    mapping(uint256 => bytes[]) public proposalCalldatas;
    /// @notice The official each proposal's receipts:
    /// Receipts of ballots for the entire set of voters
    mapping(uint256 => mapping(address => Receipt)) public proposalReceipts;

    /// @notice The latest proposal for each proposer
    mapping(address => uint256) public latestProposalIds;

    struct Proposal {
        // Unique id for looking up a proposal
        uint256 id;
        // Creator of the proposal
        address proposer;
        // The timestamp that the proposal will be available for execution, set once the vote succeeds
        uint256 eta;
        // The block at which voting begins: holders must delegate their votes prior to this block
        uint256 startBlock;
        // The block at which voting ends: votes must be cast prior to this block
        uint256 endBlock;
        // Current number of votes in favor of this proposal
        uint256 forVotes;
        // Current number of votes in opposition to this proposal
        uint256 againstVotes;
        // Current number of votes for abstaining for this proposal
        uint256 abstainVotes;
        // Flag marking whether the proposal has been canceled
        bool canceled;
        // Flag marking whether the proposal has been executed
        bool executed;
    }

    /// @notice Ballot receipt record for a voter
    struct Receipt {
        // Whether or not a vote has been cast
        bool hasVoted;
        // Whether or not the voter supports the proposal or abstains
        uint8 support;
        // The number of votes the voter had, which were cast
        uint96 votes;
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
}
