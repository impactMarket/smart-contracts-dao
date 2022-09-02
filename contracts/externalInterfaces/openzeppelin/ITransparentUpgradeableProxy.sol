// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface ITransparentUpgradeableProxy {
    function admin() external view returns (address admin_);

    function implementation() external returns (address implementation_);

    function changeAdmin(address newAdmin) external virtual;

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}
