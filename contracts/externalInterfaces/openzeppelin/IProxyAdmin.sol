// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

interface IProxyAdmin {
    function getProxyImplementation(TransparentUpgradeableProxy proxy)
        external
        view
        virtual
        returns (address);

    function getProxyAdmin(TransparentUpgradeableProxy proxy)
        external
        view
        virtual
        returns (address);

    function changeProxyAdmin(TransparentUpgradeableProxy proxy, address newAdmin) external virtual;

    function upgrade(TransparentUpgradeableProxy proxy, address implementation) external virtual;

    function upgradeAndCall(
        TransparentUpgradeableProxy proxy,
        address implementation,
        bytes memory data
    ) external payable virtual;

    function owner() external view virtual returns (address);
}
