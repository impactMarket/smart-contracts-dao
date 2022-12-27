// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "../../../community/interfaces/ICommunityAdmin.sol";
import "./IImpactMarketCouncil.sol";

abstract contract ImpactMarketCouncilStorageV1 is IImpactMarketCouncil {
    ProxyAdmin public communityProxyAdmin;
    ICommunityAdmin public communityAdmin;

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public quorumVotes;

    /// @notice The total number of proposals
    uint256 public proposalCount;

    /// @notice The council members
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

    /// @notice The official each proposal's targets:
    /// An ordered list of target addresses for calls to be made
    mapping(uint256 => address[]) public proposalTargets;
}
