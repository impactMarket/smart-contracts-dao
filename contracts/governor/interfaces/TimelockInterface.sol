//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface TimelockInterface {
  function admin() external view returns (address);

  function delay() external view returns (uint256);

  function GRACE_PERIOD() external view returns (uint256);

  function acceptAdmin() external;

  function queuedTransactions(bytes32 _hash) external view returns (bool);

  function queueTransaction(
    address target,
    uint256 value,
    string calldata signature,
    bytes calldata data,
    uint256 eta
  ) external returns (bytes32);

  function cancelTransaction(
    address _target,
    uint256 _value,
    string calldata _signature,
    bytes calldata _data,
    uint256 _eta
  ) external;

  function executeTransaction(
    address _target,
    uint256 _value,
    string calldata _signature,
    bytes calldata _data,
    uint256 _eta
  ) external payable returns (bytes memory);
}
