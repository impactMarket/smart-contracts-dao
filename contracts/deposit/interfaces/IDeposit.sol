//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../externalInterfaces/aave/ILendingPool.sol";
import "../../donationMiner/interfaces/IDonationMiner.sol";

interface IDeposit {
    struct Depositor {
        uint256 amount;
        uint256 scaledBalance;
    }

    struct Token {
        uint256 totalAmount;
        EnumerableSet.AddressSet depositorList;
        mapping(address => Depositor) depositors;
    }

    function getVersion() external pure returns(uint256);
    function lendingPool() external view returns(ILendingPool);
    function treasury() external view returns (ITreasury);
    function donationMiner() external view returns (IDonationMiner);
    function token(address _tokenAddress) external view returns(uint256 totalAmount, uint256 depositorListLength);
    function tokenDepositorListAt(address _tokenAddress, uint256 _index) external view returns(address);
    function tokenListLength() external view returns (uint256);
    function tokenListAt(uint256 _index) external view returns (address);
    function isToken(address _tokenAddress) external view returns (bool);
    function tokenDepositor(address _tokenAddress, address _depositorAddress)
        external view returns (uint256 amount, uint256 scaledBalance);
    function updateTreasury(ITreasury _newTreasury) external;
    function updateDonationMiner(IDonationMiner _newDonationMiner) external;
    function updateLendingPool(ILendingPool _lendingPool) external;
    function addToken(address _tokenAddress) external;
    function removeToken(address _tokenAddress) external;
    function deposit(address _tokenAddress, uint256 _amount) external;
    function withdraw(address _tokenAddress, uint256 _amount) external;
    function donateInterest(address _depositorAddress, address _tokenAddress, uint256 _amount) external;
    function interest(address _depositorAddress, address _tokenAddress, uint256 _amount) external view returns (uint256);
}
