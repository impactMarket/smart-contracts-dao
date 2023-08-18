//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "../../externalInterfaces/socialConnect/ISocialConnect.sol";
import "../../community/interfaces/ICommunity.sol";
import "../../donationMiner/interfaces/IDonationMiner.sol";
import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IAirdropV3 {
    struct Beneficiary {
        uint256 amount;
    }

    function getVersion() external pure returns(uint256);
    function donationMiner() external view returns(IDonationMiner);
    function socialConnect() external view returns(ISocialConnect);
    function socialConnectIssuer() external view returns(address);
    function amount() external view returns(uint256);

    function updateAmount(uint256 newTrancheAmount) external;

    function register(address[] memory beneficiaryAddresses, address[] memory communityAddresses) external;
}
