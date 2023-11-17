//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../treasury/interfaces/ITreasury.sol";

interface IContributor {
    struct Contributor {
        uint256 claimedAmount;
        uint256 lastClaimTime;
        uint256 dailyPaymentAmount;
    }

    function getVersion() external pure returns(uint256);
    function PACT() external view returns(IERC20);
    function cUSD() external view returns(IERC20);
    function treasury() external view returns(ITreasury);
    function claimPeriod() external view returns(uint256);
    function contributorListLength() external view returns (uint256);
    function contributorListAt(uint256 index_) external view returns(address);

    function claim(address contributorAddress) external;
    function claimAmount(address contributorAddress) external returns(uint256);
}
