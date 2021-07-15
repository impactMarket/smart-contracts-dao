//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@nomspace/nomspace/contracts/interfaces/INom.sol";
import "../romulus/RomulusDelegator.sol";

contract IPCTDelegator is RomulusDelegator {
  constructor(
    address timelock_,
    address token_,
    address releaseToken_,
    address admin_,
    address implementation_,
    uint votingPeriod_,
    uint votingDelay_,
    uint proposalThreshold_
  ) RomulusDelegator(timelock_, token_, releaseToken_, admin_, implementation_, votingPeriod_, votingDelay_, proposalThreshold_) {}

  function resolve(bytes32 addr) public pure override returns (address) {
    return address(uint160(uint256(addr) >> (12 * 8)));
  }
}

