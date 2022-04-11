// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./interfaces/ICommunityAdmin.sol";
import "../interfaces/IProxyAdmin.sol";
import "../interfaces/ITransparentUpgradeableProxy.sol";

contract CommunityMiddleProxy is TransparentUpgradeableProxy {
    /** @notice Calls the TransparentUpgradeableProxy constructor
     *
     * @param _fakeLogic       any contract address
     * @param _fakeProxyAdmin  any address
     *
     * @dev _fakeLogic, _fakeProxyAdmin are used only
     *     to satisfy the TransparentUpgradeableProxy requirements.
     *     Their values are not important because this is a middle proxy contract
     *     the real logic ans proxy admin values are stored into the CommunityProxy
     */
    constructor(address _fakeLogic, address _fakeProxyAdmin)
        TransparentUpgradeableProxy(_fakeLogic, _fakeProxyAdmin, "")
    {}

    /**
     * @notice Returns the community implementation address.
     *
     * @dev this is a custom method that gets the community implementation address from the CommunityAdmin
     */
    function _implementation() internal view virtual override returns (address impl) {
        // Admin of the CommunityProxy is CommunityAdmin.communityProxyAdmin
        // the owner of CommunityAdmin.communityProxyAdmin is CommunityAdmin
        // so:
        // CommunityAdmin.communityProxyAdmin = IProxyAdmin(_admin())
        // CommunityAdmin = (CommunityAdmin.communityProxyAdmin).owner = (IProxyAdmin(_admin())).owner()
        // communityImplementation = CommunityAdmin.communityImplementation
        // communityImplementation = ICommunityAdmin(IProxyAdmin(_admin()).owner()).communityImplementation()
        return address(ICommunityAdmin(IProxyAdmin(_admin()).owner()).communityImplementation());
    }
}
