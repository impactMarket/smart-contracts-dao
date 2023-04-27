//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../externalInterfaces/socialConnect/ISocialConnect.sol";

interface IAirdropV3 {
    struct Beneficiary {
        uint256 claimedAmount;
        uint256 lastClaimTime;
    }

    function getVersion() external pure returns(uint256);
    function PACT() external view returns(IERC20);
    function socialConnect() external view returns(ISocialConnect);
    function socialConnectIssuer() external view returns(address);
    function startTime() external view returns(uint256);
    function trancheAmount() external view returns(uint256);
    function totalAmount() external view returns(uint256);
    function cooldown() external view returns(uint256);

    function updateStartTime(uint256 _newStartTime) external;
    function updateTrancheAmount(uint256 _newTrancheAmount) external;
    function updateTotalAmount(uint256 _newTotalAmount) external;
    function updateCooldown(uint256 _newCooldown) external;

    function claim(
        address _beneficiaryAddress
    ) external;
}
