// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "./ITreasuryLpSwap.sol";

/**
 * @title Storage for TreasuryLpSwap
 * @notice For future upgrades, do not change TreasuryLpSwapStorageV1. Create a new
 * contract which implements TreasuryLpSwapStorageV1 and following the naming convention
 * TreasuryLpSwapStorageVX.
 */
abstract contract TreasuryLpSwapStorageV1 is ITreasuryLpSwap {
    ITreasury public override treasury;
    IUniswapRouter02 public override uniswapRouter;
    IQuoter public override uniswapQuoter;
    INonfungiblePositionManager public override uniswapNFTPositionManager;
}
