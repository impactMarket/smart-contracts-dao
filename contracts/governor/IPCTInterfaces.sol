//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@ubeswap/governance/contracts/interfaces/IHasVotes.sol";

contract IPCTEvents {
  /// @notice An event emitted when a new proposal is created
  event ProposalCreated(
    uint256 id,
    address proposer,
    address[] targets,
    uint256[] values,
    string[] signatures,
    bytes[] calldatas,
    uint256 startBlock,
    uint256 endBlock,
    string description
  );

  /// @notice An event emitted when a vote has been cast on a proposal
  /// @param voter The address which casted a vote
  /// @param proposalId The proposal id which was voted on
  /// @param support Support value for the vote. 0=against, 1=for, 2=abstain
  /// @param votes Number of votes which were cast by the voter
  /// @param reason The reason given for the vote by the voter
  event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 votes, string reason);

  /// @notice An event emitted when a proposal has been canceled
  event ProposalCanceled(uint256 id);

  /// @notice An event emitted when a proposal has been queued in the Timelock
  event ProposalQueued(uint256 id, uint256 eta);

  /// @notice An event emitted when a proposal has been executed in the Timelock
  event ProposalExecuted(uint256 id);

  /// @notice An event emitted when the voting delay is set
  event VotingDelaySet(uint256 oldVotingDelay, uint256 newVotingDelay);

  /// @notice An event emitted when the voting period is set
  event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod);

  /// @notice Emitted when implementation is changed
  event NewImplementation(address oldImplementation, address newImplementation);

  /// @notice Emitted when proposal threshold is set
  event ProposalThresholdSet(uint256 oldProposalThreshold, uint256 newProposalThreshold);

  /// @notice Emitted when pendingAdmin is changed
  event NewPendingAdmin(address oldPendingAdmin, address newPendingAdmin);

  /// @notice Emitted when pendingAdmin is accepted, which means admin is updated
  event NewAdmin(address oldAdmin, address newAdmin);
}

contract IPCTDelegatorStorage {
  /// @notice Administrator for this contract
  address public admin;

  /// @notice Pending administrator for this contract
  address public pendingAdmin;

  /// @notice Active brains of Governor
  address public implementation;
}

/**
 * @title Storage for Governor Bravo Delegate
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
  enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }
}

interface TimelockInterface {
  function admin() external view returns (address);

  function delay() external view returns (uint256);

  function GRACE_PERIOD() external view returns (uint256);

  function acceptAdmin() external;

  function queuedTransactions(bytes32 hash) external view returns (bool);

  function queueTransaction(
    address target,
    uint256 value,
    string calldata signature,
    bytes calldata data,
    uint256 eta
  ) external returns (bytes32);

  function cancelTransaction(
    address target,
    uint256 value,
    string calldata signature,
    bytes calldata data,
    uint256 eta
  ) external;

  function executeTransaction(
    address target,
    uint256 value,
    string calldata signature,
    bytes calldata data,
    uint256 eta
  ) external payable returns (bytes memory);
}
