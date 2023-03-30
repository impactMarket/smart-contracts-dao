//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IMicrocredit {
    struct WalletMetadata {
        uint256 userId;
        address movedTo;
    }

    struct User {
        Loan[] loans;
    }

    struct Repayment {
        uint256 date;
        uint256 amount;
    }

    struct Loan {
        uint256 amountBorrowed;
        uint256 period;                   // the number of seconds after a loan should be fully repaid
        uint256 dailyInterest;
        uint256 claimDeadline;
        uint256 startDate;                // the timestamp the user claimed the amountBorrowed
        uint256 lastComputedDebt;
        uint256 amountRepayed;
        Repayment[] repayments;
    }

    function getVersion() external pure returns(uint256);
    function cUSD() external view returns(IERC20);
    function revenueAddress() external view returns(address);
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
    function updateRevenueAddress(address newRevenueAddress) external;
    function addManagers(address[] calldata managerAddresses) external;
    function removeManagers(address[] calldata managerAddresses) external;
    function addLoan(
        address userAddress,
        uint256 amount,
        uint256 period,
        uint256 dailyInterest,
        uint256 claimDeadline
    ) external;
    function addLoans(
        address[] calldata userAddresses,
        uint256[] calldata amounts,
        uint256[] calldata periods,
        uint256[] calldata dailyInterests,
        uint256[] calldata claimDeadlines
    ) external;
    function changeUserAddress(address oldWalletAddress, address newWalletAddress) external;
    function claimLoan(uint256 loanId) external;
    function repayLoan(uint256 loanId, uint256 repaymentAmount) external;
    function transferERC20(IERC20 _token, address _to, uint256 _amount) external;
}
