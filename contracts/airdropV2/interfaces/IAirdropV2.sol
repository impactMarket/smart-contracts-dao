//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IAirdropV2 {
    struct Beneficiary {
        uint256 claimedAmount;
        uint256 lastClaimTime;
    }

    function getVersion() external pure returns(uint256);
    function PACT() external view returns(IERC20);
    function startTime() external view returns(uint256);
    function trancheAmount() external view returns(uint256);
    function totalAmount() external view returns(uint256);
    function cooldown() external view returns(uint256);
    function merkleRoot() external view returns(bytes32);

    function updateStartTime(uint256 _newStartTime) external;
    function updateTrancheAmount(uint256 _newTrancheAmount) external;
    function updateTotalAmount(uint256 _newTotalAmount) external;
    function updateCooldown(uint256 _newCooldown) external;
    function updateMerkleRoot(bytes32 _newMerkleRoot) external;

    function claim(
        address _beneficiaryAddress,
        bytes32[] calldata _merkleProof
    ) external;
}
