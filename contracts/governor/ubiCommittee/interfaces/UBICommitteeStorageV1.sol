// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "../../../community/interfaces/ICommunityAdmin.sol";
import "./IUBICommittee.sol";

abstract contract UBICommitteeStorageV1 is IUBICommittee {
    ProxyAdmin public communityProxyAdmin;
    ICommunityAdmin public communityAdmin;

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public quorumVotes;

    /// @notice The total number of proposals
    uint256 public proposalCount;

    /// @notice The committee members
    mapping(address => bool) public members;

    /// @notice The official record of all proposals ever proposed
    mapping(uint256 => Proposal) public proposals;
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
        Expired,
        Succeeded,
        Executed
    }
}
