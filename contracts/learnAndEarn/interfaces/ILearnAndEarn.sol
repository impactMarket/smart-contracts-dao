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
        uint256 balance;
        LevelState state;
        mapping(address => uint256) claims;    // the reward amount claimed by beneficiaries for this level
    }

    /**
     *  A program can have multiple levels;
     *  A beneficiary can claim rewards after each level
     */
    struct Program {
        string name;
        IERC20 token;
        mapping(uint256 => Level) levels;
    }

    function getVersion() external pure returns (uint256);
    function signerWalletAddress() external view returns(address);
    function communityAdmin() external view returns(ICommunityAdmin);
    function programs(uint256 _programId) external view returns(
        string memory name,
        IERC20 token
    );
    function programLevels(uint256 _programId, uint256 _levelId)
        external view returns (uint256 balance, LevelState state);
    function programLevelClaims(
        uint256 _programId,
        uint256 _levelId,
        address _beneficiary
    ) external view returns (uint256);
    function updateSignerWalletAddress(address _newSignerAddress) external;
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function addProgram(uint256 _programId, string calldata _name, IERC20 _token) external;
    function addProgramLevel(uint256 _programId, uint256 _levelId) external;
    function fundProgramLevel(uint256 _programId, uint256 _levelId, uint256 _amount) external;
    function pauseProgramLevel(uint256 _programId, uint256 _levelId) external;
    function unpauseProgramLevel(uint256 _programId, uint256 _levelId) external;
    function cancelProgramLevel(uint256 _programId, uint256 _levelId, address _fundRecipient) external;
    function claimRewardForLevels(
        address _beneficiary,
        uint256 _programId,
        uint256[] calldata _levelIds,
        uint256[] calldata _rewardAmounts,
        bytes[] calldata _signatures
    ) external;
}
