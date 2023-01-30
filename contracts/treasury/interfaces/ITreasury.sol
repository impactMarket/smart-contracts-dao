//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../community/interfaces/ICommunityAdmin.sol";
import "../../externalInterfaces/uniswapV3/IUniswapRouter02.sol";
import "../../externalInterfaces/uniswapV3/IQuoter.sol";

interface ITreasury {
    struct Token {
        uint256 rate;
        bytes exchangePath;
    }

    function getVersion() external pure returns(uint256);
    function communityAdmin() external view returns(ICommunityAdmin);
    function uniswapRouter() external view returns(IUniswapRouter02);
    function uniswapQuoter() external view returns(IQuoter);
    function updateCommunityAdmin(ICommunityAdmin _communityAdmin) external;
    function updateUniswapRouter(IUniswapRouter02 _uniswapRouter) external;
    function updateUniswapQuoter(IQuoter _uniswapQuoter) external;
    function transfer(IERC20 _token, address _to, uint256 _amount) external;
    function isToken(address _tokenAddress) external view returns (bool);
    function tokenListLength() external view returns (uint256);
    function tokenListAt(uint256 _index) external view returns (address);
    function tokens(address _tokenAddress) external view returns (uint256 rate, bytes memory exchangePath);
    function setToken(address _tokenAddress, uint256 _rate, bytes calldata _exchangePath) external;
    function removeToken(address _tokenAddress) external;
    function getConvertedAmount(address _tokenAddress, uint256 _amount) external returns (uint256);
    function convertAmount(
        address _tokenAddress,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes memory _exchangePath
    ) external;
}
