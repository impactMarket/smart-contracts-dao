// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC202} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../community/interfaces/ICommunityAdmin.sol";

interface ILearnAndEarn {
    enum ProgramState {
        Invalid,
        Valid,
        Paused,
        Canceled
    }

    /**
     *  A program can have multiple courses;
     *  A beneficiary can claim rewards after each course
     */
    struct Program {
        IERC202 token;
        uint256 balance;
        ProgramState state;
        mapping(uint256 => mapping(address => uint256)) courseClaims;    // the reward amount claimed by beneficiaries for each course
    }

    function getVersion() external pure returns (uint256);
    function signerWalletAddress() external view returns(address);
    function communityAdmin() external view returns(ICommunityAdmin);
    function programs(uint256 _id) external view returns(
        IERC202 token,
        uint256 balance,
        ProgramState state
    );
    function programListAt(uint256 _index) external view returns (uint256);
    function programListLength() external view returns (uint256);
    function programCourseClaimAmount(
        uint256 _programId,
        uint256 _courseId,
        address _beneficiary
    ) external view returns (uint256);
    function updateSignerWalletAddress(address _newSignerAddress) external;
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function addProgram(uint256 _id, IERC202 _token) external;
    function fundProgram(uint256 _programId, uint256 _amount) external;
    function pauseProgram(uint256 _id) external;
    function unpauseProgram(uint256 _id) external;
    function cancelProgram(uint256 _id, address _fundRecipient) external;
    function claimRewardForCourses(
        address _beneficiary,
        uint256 _programId,
        uint256[] calldata _courseIds,
        uint256[] calldata _rewardAmounts,
        bytes[] calldata _signatures
    ) external;
}
