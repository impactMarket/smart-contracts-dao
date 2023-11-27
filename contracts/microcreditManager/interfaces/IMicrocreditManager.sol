//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../microcredit/interfaces/IMicrocredit.sol";
import "../../externalInterfaces/uniswapV3/IQuoter.sol";

interface IMicrocreditManager {
    struct TokenPair {
        uint24 uniswapFee;
    }
    struct ReferenceToken {
        EnumerableSet.AddressSet claimTokenList;
        mapping(address => TokenPair) claimTokens;
    }

    struct Loan {
        address borrowerAddress;
        uint256 borrowerLoanId;
    }

    struct RewardPeriod {
        uint256 startDate;
        uint256 endDate;
        uint256 baseReward;
        uint256 extraReward;
        uint256 completedLoansLength;             //number of loans that have been fully repaid in this reward period
        mapping(uint256 => Loan) completedLoans;  //list with all loans that have been fully repaid in this reward period
    }

    struct Manager {
        address referenceToken;                         //Token to be used as reward reference (usually cUSD)
        address claimToken;                             //Token to be used as reward token (usually PACT)
        uint256 baseReward;                             //Amount of pact (in cusd) as base reward
                                    /** Amount of pact (in cusd) as base reward
                                     *             E.g. A manager has:
                                     *                    - referenceToken = cUSD
                                     *                    - claimToken = PACT
                                     *                    - baseReward = 100e18
                                     *                    - 1 cUSD = 50 PACTs
                                     *              That user fill receive 100 * 50 PACTs as reward
                                     */
        uint256 claimDelay;                           //Period of time between two claims
        uint256 rewardPeriodsLength;                    //how many rewards periods have been since adding the manager
        mapping(uint256 => RewardPeriod) rewardPeriods; //list with all rewards periods/
        uint256 rewardPeriodToClaim;                    //first unclaimed reward period
    }

    function getVersion() external pure returns(uint256);
    function rewardPercentage() external view returns(uint256);
    function microcredit() external view returns(IMicrocredit);
    function uniswapQuoter() external view returns(IQuoter);
    function referenceTokenListAt(uint256 index) external view returns (address);
    function referenceTokenListLength() external view returns (uint256);
    function referenceToken(address _referenceTokenAddress) external view returns (uint256 claimTokenListLength);
    function referenceTokenClaimTokenListAt(
        address referenceTokenAddress,
        uint256 claimTokenIndex
    ) external view returns (address);
    function tokenPair(address referenceToken, address claimToken) external returns(TokenPair memory);
    function managerListLength() external view returns (uint256);
    function managerListAt(uint256 index_) external view returns(address);
    function managers(address _managerAddress) external returns(
        address referenceToken,
        address claimToken,
        uint256 baseReward,
        uint256 claimDelay,
        uint256 rewardPeriodsLength,
        uint256 rewardPeriodToClaim
    );
    function managerRewardPeriods(address _managerAddress, uint256 _rewardPeriodIndex) external returns(
        uint256 startDate,
        uint256 endDate,
        uint256 baseReward,
        uint256 extraReward,
        uint256 completedLoansLength
    );
    function managerRewardPeriodLoan(
        address _managerAddress,
        uint256 _rewardPeriodIndex,
        uint256 _loanIndex
    ) external view returns(
        address borrowerAddress,
        uint256 borrowerLoanId
    );
    function editTokenPair(
        address referenceTokenAddress,
        address claimTokenAddress,
        uint24 uniswapPairFee
    ) external;
    function addManager(
        address _managerAddress,
        address _referenceToken,
        address _claimToken,
        uint256 _baseReward,
        uint256 _claimDelay
    ) external;
    function claim() external;
    function claimAmounts(address managerAddress) external returns(uint256 totalBaseReward, uint256 totalExtraReward);
    function addCompletedLoanToManager(address managerAddress, address _borrowerAddress, uint256 loanId) external;
}
