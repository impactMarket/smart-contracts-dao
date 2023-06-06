// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../community/interfaces/ICommunityAdmin.sol";

interface ILearnAndEarn {
    enum LevelState {
        Invalid,
        Valid,
        Paused,
        Canceled
    }

    struct Level {
        IERC20 token;
        uint256 balance;
        LevelState state;
        mapping(address => uint256) claims;    // the reward amount claimed by beneficiaries for this level
    }

    function getVersion() external pure returns (uint256);
    function signerWalletAddress() external view returns(address);
    function communityAdmin() external view returns(ICommunityAdmin);
    function levelListLength() external view returns (uint256);
    function levelListAt(uint256 index) external view returns (uint256);
    function levels(uint256 levelId)
        external view returns ( IERC20 token, uint256 balance, LevelState state);
    function levelClaims(
        uint256 levelId,
        address beneficiary
    ) external view returns (uint256);
    function updateSignerWalletAddress(address newSignerAddress) external;
    function updateCommunityAdmin(ICommunityAdmin communityAdmin) external;
    function addLevel(uint256 levelId, IERC20 token) external;
    function updateLevel(uint256 levelId, IERC20 token) external;
    function fundLevel(uint256 levelId, uint256 amount) external;
    function pauseLevel(uint256 levelId) external;
    function unpauseLevel(uint256 levelId) external;
    function cancelLevel(uint256 levelId, address fundRecipient) external;
    function claimRewardForLevels(
        address beneficiary,
        uint256[] calldata levelIds,
        uint256[] calldata rewardAmounts,
        bytes[] calldata signatures
    ) external;
}
