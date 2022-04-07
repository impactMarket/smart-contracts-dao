// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./interfaces/ICommunityAdmin.sol";
import "../interfaces/IProxyAdmin.sol";


import "hardhat/console.sol";

contract CommunityProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address _proxyAdmin)
        TransparentUpgradeableProxy(_logic, _proxyAdmin, "")
    {}

    /**
     * @dev Returns the current implementation address.
     */
    function _implementation() internal view virtual override returns (address impl) {
//        console.log('_implementation @!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        address _communityAddress = address(this);
        IProxyAdmin _communityProxyAdmin = IProxyAdmin(_admin());
//        console.log(_admin());
        address _communityAdminAddress = _communityProxyAdmin.owner();
//        console.log('template:', address(ICommunityAdmin(_communityAdminAddress).communityTemplate()));
//        console.log(address(this));
//        console.log('_admin: ', _admin());
//        console.log(IProxyAdmin(_admin()).owner());
//        console.log(address(IProxyAdmin(admin()).));
        return 0x9A676e781A523b5d0C0e43731313A708CB607508;
    }
}
