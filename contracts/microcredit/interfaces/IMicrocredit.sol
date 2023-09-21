//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../donationMiner/interfaces/IDonationMiner.sol";

interface IMicrocredit {
    struct UserOld {
        LoanOld[] loans;
    }

    struct LoanOld {
        uint256 amountBorrowed;
        uint256 period;                   // the number of seconds after a loan should be fully repaid
        uint256 dailyInterest;
        uint256 claimDeadline;
        uint256 startDate;                // the timestamp the user claimed the amountBorrowed
        uint256 lastComputedDebt;
        uint256 amountRepayed;
        Repayment[] repayments;
        uint256 lastComputedDate;
//        address managerAddress;
    }

    struct WalletMetadata {
        uint256 userId;
        address movedTo;
    }

    struct User {
        uint256 loansLength;
        mapping(uint256 => Loan) loans;
    }

    struct ManagerTokenLimit {
        uint256 currentLentAmountLimit;
        uint256 currentLentAmount;
    }

    struct Manager {
        uint256 currentLentAmountLimitOld;
        uint256 currentLentAmountOld;
        mapping(address => ManagerTokenLimit) tokenLimits;
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
        uint256 repaymentsLength;
        mapping(uint256 => Repayment) repayments;
        uint256 lastComputedDate;
        address managerAddress;
        address tokenAddress;
    }

    struct Token {
        bool active;
    }

    function getVersion() external pure returns(uint256);
    function cUSD() external view returns(IERC20);
    function revenueAddress() external view returns(address);
    function donationMiner() external view returns(IDonationMiner);
    function walletMetadata(address userAddress)
        external view returns(uint256 userId, address movedTo, uint256 loansLength);
    struct UserLoanResponse {
        uint256 amountBorrowed;
        uint256 period;
        uint256 dailyInterest;
        uint256 claimDeadline;
        uint256 startDate;
        uint256 currentDebt;
        uint256 lastComputedDebt;
        uint256 amountRepayed;
        uint256 repaymentsLength;
        uint256 lastComputedDate;
        address managerAddress;
        address tokenAddress;
    }
    function userLoans(address userAddress, uint256 loanId) external view returns(
        UserLoanResponse memory userLoan);
    function userLoanRepayments(address userAddress, uint256 loanId, uint256 repaymentId)
        external view returns( uint256 date, uint256 amount);
    function walletListAt(uint256 index) external view returns (address);
    function walletListLength() external view returns (uint256);
    function managerListAt(uint256 index) external view returns (address);
    function managerListLength() external view returns (uint256);
    function managers(address managerAddress) external view returns(ManagerTokenLimit[] memory);
    function managerTokens(address _managerAddress, address _tokenAddress) external view returns(ManagerTokenLimit memory);
    function tokenListAt(uint256 index) external view returns (address);
    function tokenListLength() external view returns (uint256);
    function tokens(address tokenAddress) external view returns (bool active);
    function updateRevenueAddress(address newRevenueAddress) external;
    function updateDonationMiner(IDonationMiner newDonationMiner) external;
    function addManagers(
        address[] calldata managerAddresses,
        address[] calldata tokenAddresses,
        uint256[] calldata currentLentAmountLimit
    ) external;
    function removeManagers(address[] calldata managerAddresses) external;
    function addLoan(
        address userAddress,
        address tokenAddress,
        uint256 amount,
        uint256 period,
        uint256 dailyInterest,
        uint256 claimDeadline
    ) external;
    function addLoans(
        address[] calldata userAddresses,
        address[] calldata tokenAddresses,
        uint256[] calldata amounts,
        uint256[] calldata periods,
        uint256[] calldata dailyInterests,
        uint256[] calldata claimDeadlines
    ) external;
    function cancelLoans(
        address[] calldata userAddresses,
        uint256[] calldata loansIds
    ) external;
    function changeUserAddress(address oldWalletAddress, address newWalletAddress) external;
    function claimLoan(uint256 loanId) external;
    function repayLoan(uint256 loanId, uint256 repaymentAmount) external;
    function changeManager(address[] memory borrowerAddresses, address managerAddress) external;
    function addToken(address tokenAddress) external;
    function removeToken(address tokenAddress) external;
    function transferERC20(IERC20 token, address to, uint256 amount) external;
}

