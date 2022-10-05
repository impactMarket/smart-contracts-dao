//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../donationMiner/interfaces/IDonationMiner.sol";
import "../../externalInterfaces/openzeppelin/IMintableERC20.sol";

interface IStaking {
    struct Unstake {
        uint256 amount;         //amount unstaked
        uint256 cooldownBlock;  //first block number that will allow holder to claim this unstake
    }

    struct Holder {
        uint256 amount;          // amount of PACT that are staked by holder
        uint256 nextUnstakeId;   //
        Unstake[] unstakes;      //list of all unstakes amount
    }

    function getVersion() external pure returns(uint256);
    function updateCooldown(uint256 _newCooldown) external;
    function PACT() external view returns (IERC20);
    function SPACT() external view returns (IMintableERC20);
    function donationMiner() external view returns (IDonationMiner);
    function cooldown() external view returns(uint256);
    function currentTotalAmount() external view returns(uint256);
    function stakeholderAmount(address _holderAddress) external view returns(uint256);
    function stakeholder(address _holderAddress) external view returns (uint256 amount, uint256 nextUnstakeId, uint256 unstakeListLength, uint256 unstakedAmount);
    function stakeholderUnstakeAt(address _holderAddress, uint256 _unstakeIndex) external view returns (Unstake memory);
    function stakeholdersListAt(uint256 _index) external view returns (address);
    function stakeholdersListLength() external view returns (uint256);

    function stake(address _holder, uint256 _amount) external;
    function unstake(uint256 _amount) external;
    function claim() external;
    function claimPartial(uint256 _lastUnstakeId) external;
    function claimAmount(address _holderAddress) external view returns (uint256);
}
