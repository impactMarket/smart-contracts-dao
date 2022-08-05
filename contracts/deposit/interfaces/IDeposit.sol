//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../externalInterfaces/aave/ILendingPool.sol";
import "../../treasury/interfaces/ITreasury.sol";

interface IDeposit {
    struct Deposit {
        uint256 amount;
        uint256 scaledBalance;
    }

    struct Token {
        EnumerableSet.AddressSet depositors;
        mapping(address => Deposit) deposits;
    }

    function getVersion() external returns(uint256);
    function lendingPool() external view returns(ILendingPool);
    function treasury() external view returns (ITreasury);
    function tokenListLength() external view returns (uint256);
    function tokenListAt(uint256 _index) external view returns (address);
    function isToken(address _tokenAddress) external view returns (bool);
    function tokenDeposit(address _tokenAddress, address _depositor) external view returns (uint256 amount, uint256 scaledBalance);
    function updateTreasury(ITreasury _newTreasury) external;
    function updateLendingPool(ILendingPool _lendingPool) external;
    function addToken(address _tokenAddress) external;
    function removeToken(address _tokenAddress) external;
    function deposit(address _tokenAddress, uint256 _amount) external;
}
