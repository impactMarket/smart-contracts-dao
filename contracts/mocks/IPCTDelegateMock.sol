//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "../governor/IPCTDelegate.sol";

contract IPCTDelegateMock is IPCTDelegate {
    /**
     * @notice Function for setting the voting period
     * @param newVotingPeriod new voting period, in blocks
     */
    function _setVotingPeriod(uint256 newVotingPeriod) external override {
        uint256 oldVotingPeriod = votingPeriod;
        votingPeriod = newVotingPeriod;

        emit VotingPeriodSet(oldVotingPeriod, votingPeriod);
    }
}
