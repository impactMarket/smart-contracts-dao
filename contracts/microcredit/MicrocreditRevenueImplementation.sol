//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/MicrocreditRevenueStorageV1.sol";

contract MicrocreditRevenueImplementation is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    MicrocreditRevenueStorageV1
{
    using SafeERC20Upgradeable for IERC20;

    /**
     * @notice Used to initialize the MicrocreditRevenue contract
     */
    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param _token address of the ERC20 token
     * @param _to address of the receiver
     * @param _amount amount of the transaction
     */
    function transferERC20(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner nonReentrant {
        _token.safeTransfer(_to, _amount);
    }
}
