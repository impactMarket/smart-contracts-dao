//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../treasury/interfaces/ITreasury.sol";
import "../../externalInterfaces/uniswapV3/INonfungiblePositionManager.sol";
import "../../externalInterfaces/uniswapV3/IUniswapRouter02.sol";
import "../../externalInterfaces/uniswapV3/IQuoter.sol";

interface ITreasuryLpSwap {
    function getVersion() external pure returns(uint256);
    function treasury() external view returns(ITreasury);
    function uniswapRouter() external view returns(IUniswapRouter02);
    function uniswapQuoter() external view returns(IQuoter);
    function uniswapNFTPositionManager() external view returns(INonfungiblePositionManager);
    function updateTreasury(ITreasury _treasury) external;
    function updateUniswapRouter(IUniswapRouter02 _uniswapRouter) external;
    function updateUniswapQuoter(IQuoter _uniswapQuoter) external;
    function updateUniswapNFTPositionManager(INonfungiblePositionManager _newUniswapNFTPositionManager) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function convertAmount(
        address _tokenAddress,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes memory _exchangePath
    ) external;
    function addToLp(IERC20 _token, uint256 _amount) external;
    function collectFees(uint256 _uniswapNFTPositionManagerId) external returns (uint256 amount0, uint256 amount1);
    function decreaseLiquidity(uint256 _uniswapNFTPositionManagerId, uint128 _liquidityAmount) external returns (uint256 amount0, uint256 amount1);
}
