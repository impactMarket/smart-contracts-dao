//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface IMicrocreditOld {
    function walletMetadata(address userAddress)
    external view returns(uint256 userId, address movedTo, uint256 loansLength);
    function userLoans(address userAddress, uint256 loanId) external view returns(
        uint256 amountBorrowed,
        uint256 period,
        uint256 dailyInterest,
        uint256 claimDeadline,
        uint256 startDate,
        uint256 lastComputedDebt,
        uint256 currentDebt,
        uint256 amountRepayed,
        uint256 repaymentsLength,
        uint256 lastComputedDate
    );
    function userLoanRepayments(address userAddress, uint256 loanId, uint256 repaymentId)
    external view returns( uint256 date, uint256 amount);
    function walletListAt(uint256 index) external view returns (address);
    function walletListLength() external view returns (uint256);
    function managerListAt(uint256 index) external view returns (address);
    function managerListLength() external view returns (uint256);
    function managers(address managerAddress) external view returns (
        uint256 currentLentAmountLimit,
        uint256 currentLentAmount
    );
}

