//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "../../treasuryLpSwap/interfaces/ITreasuryLpSwap.sol";

interface ITreasury {
    enum LpStrategy {
        NONE, //all funds remains into treasury
        MainCoin,
        SecondaryCoin
    }

    struct Token {
        uint256 rate;
        LpStrategy lpStrategy;
        uint256 uniswapNFTPositionManagerId;
        bytes exchangePathToCUSD;
        bytes exchangePathToPACT;
    }

    function getVersion() external pure returns(uint256);
    function communityAdmin() external view returns(ICommunityAdmin);
    function lpSwap() external view returns(ITreasuryLpSwap);
    function lpPercentage() external view returns(uint256);
    function PACT() external view returns (IERC20);
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function updateLpSwap(ITreasuryLpSwap _lpSwap) external;
    function updateLpPercentage(uint256 _newLpPercentage) external;
    function updatePACT(IERC20 _newPACT) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function isToken(address _tokenAddress) external view returns (bool);
    function tokenListLength() external view returns (uint256);
    function tokenListAt(uint256 _index) external view returns (address);
    function tokens(address _tokenAddress) external view returns (
        uint256 rate,
        LpStrategy lpStrategy,
        uint256 uniswapNFTPositionManagerId,
        bytes calldata exchangePathToCUSD,
        bytes calldata exchangePathToPACT
    );
    function setToken(
        address _tokenAddress,
        uint256 _rate,
        LpStrategy _lpStrategy,
        uint256 _uniswapNFTPositionManagerId,
        bytes memory _exchangePathToCUSD,
        bytes memory _exchangePathToPACT
    ) external;
    function removeToken(address _tokenAddress) external;
    function getConvertedAmount(address _tokenAddress, uint256 _amount) external returns (uint256);
    function convertAmount(
        address _tokenAddress,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes memory _exchangePath
    ) external;
    function transferToTreasury(IERC20 _token, uint256 _amount) external;
    function collectAllFees(uint256 _uniswapNFTPositionManagerId) external;
}
