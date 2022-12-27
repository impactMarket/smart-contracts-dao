// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

interface IImpactMarketCouncil {
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
