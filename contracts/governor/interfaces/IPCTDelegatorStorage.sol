//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

contract IPCTDelegatorStorage {
  /// @notice Administrator for this contract
  address public admin;

  /// @notice Pending administrator for this contract
  address public pendingAdmin;

  /// @notice Active brains of Governor
  address public implementation;
}
