//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "../governor/IPCTDelegator.sol";

contract IPCTDelegatorMock is IPCTDelegator {
  constructor(
    address timelock_,
    address token_,
    address releaseToken_,
    address admin_,
    address implementation_,
    uint votingPeriod_,
    uint votingDelay_,
    uint proposalThreshold_
  ) IPCTDelegator(timelock_, token_, releaseToken_, admin_, implementation_, votingPeriod_, votingDelay_, proposalThreshold_) {}
}
