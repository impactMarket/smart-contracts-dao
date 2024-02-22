//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/MicrocreditManagerStorageV1.sol";

import "hardhat/console.sol";

contract MicrocreditManagerImplementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    MicrocreditManagerStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    event TokenPairEdited(
        address indexed referenceTokenAddress,
        address indexed claimTokenAddress,
        uint24 uniswapPairFee
    );

    /**
     * @notice Triggered when a manager has been added
     *
     * @param manager               Address of the manager
     * @param referenceToken        Token to be used as reward reference (usually cUSD)
     * @param claimToken            Token to be used as reward token (usually PACT)
     * @param baseReward            Amount of pact (in cusd) as base reward
     *             E.g. A manager has:
     *                    - referenceToken = cUSD
     *                    - claimToken = PACT
     *                    - baseReward = 100e18
     *                    - 1 cUSD = 50 PACTs
     *              That user fill receive 100 * 50 PACTs as reward
     * @param claimDelay          Period of time between two claims
     */
    event ManagerAdded(
        address indexed manager,
        address referenceToken,
        address claimToken,
        uint256 baseReward,
        uint256 claimDelay
    );

    /**
     * @notice Triggered after a claim
     *
     * @param manager                    The address of the manager that has claimed
     * @param firstRewardPeriod          The first reward period for which the claim was made
     * @param lastRewardPeriod           The last reward period for which the claim was made
     * @param totalRewardReferenceToken  The amount of the claim in reference token
     * @param totalRewardClaimToken      The amount of the claim
     */
    event Claimed(
        address indexed manager,
        uint256 firstRewardPeriod,
        uint256 lastRewardPeriod,
        uint256 totalRewardReferenceToken,
        uint256 totalRewardClaimToken
    );

    modifier onlyMicrocredit() {
        require(msg.sender == address(microcredit), "Microcredit: caller is not microcredit");
        _;
    }

    /**
     * @notice Used to initialize a new MicrocreditManager contract
     *
     * @param _microcredit              The address of the microcredit contract
     * @param _uniswapQuoter            The address of the UniswapQuoter
     */
    function initialize(
        uint256 _rewardPercentage,
        IMicrocredit _microcredit,
        IQuoter _uniswapQuoter
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        rewardPercentage = _rewardPercentage;
        microcredit = _microcredit;
        uniswapQuoter = _uniswapQuoter;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the length of the _referenceTokenList
     */
    function referenceTokenListLength() external view override returns (uint256) {
        return _referenceTokenList.length();
    }

    /**
     * @notice Returns an address from the _referenceTokenList
     *
     * @param _index index value
     * @return address of the token
     */
    function referenceTokenListAt(uint256 _index) external view override returns (address) {
        return _referenceTokenList.at(_index);
    }

    function referenceToken(
        address _referenceTokenAddress
    ) external view override returns (uint256 claimTokenListLength) {
        claimTokenListLength = _referenceTokens[_referenceTokenAddress].claimTokenList.length();
    }

    function referenceTokenClaimTokenListAt(
        address _referenceTokenAddress,
        uint256 _claimTokenIndex
    ) external view override returns (address) {
        return _referenceTokens[_referenceTokenAddress].claimTokenList.at(_claimTokenIndex);
    }

    function tokenPair(
        address _referenceToken,
        address _claimToken
    ) external view override returns (TokenPair memory) {
        return _referenceTokens[_referenceToken].claimTokens[_claimToken];
    }

    /**
     * @notice Returns the length of the managerList
     */
    function managerListLength() external view override returns (uint256) {
        return _managerList.length();
    }

    /**
     * @notice Returns an address from the managerList
     *
     * @param index_ index value
     * @return address of the manager
     */
    function managerListAt(uint256 index_) external view override returns (address) {
        return _managerList.at(index_);
    }

    function managers(address _managerAddress) external view override returns(
        address referenceToken,
        address claimToken,
        uint256 baseReward,
        uint256 claimDelay,
        uint256 rewardPeriodsLength,
        uint256 rewardPeriodToClaim
    ) {
        Manager storage _manager = _managers[_managerAddress];

        referenceToken = _manager.referenceToken;
        claimToken = _manager.claimToken;
        baseReward = _manager.baseReward;
        claimDelay = _manager.claimDelay;
        rewardPeriodsLength = _manager.rewardPeriodsLength;
        rewardPeriodToClaim = _manager.rewardPeriodToClaim;
    }

    function managerRewardPeriods(address _managerAddress, uint256 _rewardPeriodIndex) external override returns(
        uint256 startDate,
        uint256 endDate,
        uint256 baseReward,
        uint256 extraReward,
        uint256 completedLoansLength
    ) {
        Manager storage _manager = _managers[_managerAddress];

        require(
            _rewardPeriodIndex < _manager.rewardPeriodsLength,
            'MicrocreditManager: Invalid reward period'
        );

        RewardPeriod storage _rewardPeriod = _manager.rewardPeriods[_rewardPeriodIndex];

        startDate = _rewardPeriod.startDate;
        endDate = _rewardPeriod.endDate;
        baseReward = _rewardPeriod.baseReward;
        extraReward = _calculateExtraReward(_managerAddress, _rewardPeriodIndex);
        completedLoansLength = _rewardPeriod.completedLoansLength;
    }

    function managerRewardPeriodLoan(
        address _managerAddress,
        uint256 _rewardPeriodIndex,
        uint256 _loanIndex
    ) external view override returns(
        address borrowerAddress,
        uint256 borrowerLoanId
    ) {
        Manager storage _manager = _managers[_managerAddress];

        require(
            _rewardPeriodIndex <= _manager.rewardPeriodsLength,
            'MicrocreditManager: Invalid reward period'
        );

        RewardPeriod storage _rewardPeriod = _manager.rewardPeriods[_rewardPeriodIndex];

        require(
            _loanIndex < _rewardPeriod.completedLoansLength,
            'MicrocreditManager: Invalid loan'
        );

        Loan memory _loan = _rewardPeriod.completedLoans[_loanIndex];

        borrowerAddress = _loan.borrowerAddress;
        borrowerLoanId = _loan.borrowerLoanId;
    }

    function editTokenPair(
        address _referenceTokenAddress,
        address _claimTokenAddress,
        uint24 _uniswapPairFee
    ) external override onlyOwner {
        ReferenceToken storage _referenceToken = _referenceTokens[_referenceTokenAddress];

        _referenceToken.claimTokens[_claimTokenAddress].uniswapFee = _uniswapPairFee;

        if (_uniswapPairFee > 0) {
            _referenceToken.claimTokenList.add(_claimTokenAddress);
            _referenceTokenList.add(_referenceTokenAddress);
        } else {
            _referenceToken.claimTokenList.remove(_claimTokenAddress);

            if (_referenceToken.claimTokenList.length() == 0) {
                _referenceTokenList.remove(_referenceTokenAddress);
            }
        }

        emit TokenPairEdited(_referenceTokenAddress, _claimTokenAddress, _uniswapPairFee);
    }

    /**
     * @notice Adds a new manager
     *
     * @param _managerAddress     address of the manager
     * @param _baseReward         amount of pact (in cusd) as base reward
     */
    function addManager(
        address _managerAddress,
        address _referenceToken,
        address _claimToken,
        uint256 _baseReward,
        uint256 _claimDelay
    ) external override onlyOwner {
        require(
            !_managerList.contains(_managerAddress),
            "MicrocreditManager: Manager already added"
        );

        require(
            _referenceTokens[_referenceToken].claimTokens[_claimToken].uniswapFee > 0,
            "MicrocreditManager: Invalid (referenceToken, claimToken) pair"
        );

        _managerList.add(_managerAddress);

        Manager storage _manager = _managers[_managerAddress];

        _manager.referenceToken = _referenceToken;
        _manager.claimToken = _claimToken;
        _manager.baseReward = _baseReward;
        _manager.claimDelay = _claimDelay;

        _manager.rewardPeriodsLength = 1;

        RewardPeriod storage _firstRewardPeriod = _manager.rewardPeriods[0];
        _firstRewardPeriod.startDate = block.timestamp;
        _firstRewardPeriod.endDate = block.timestamp + _claimDelay - 1;
        _firstRewardPeriod.baseReward = _baseReward;

        emit ManagerAdded(_managerAddress, _referenceToken, _claimToken, _baseReward, _claimDelay);
    }


    function claimAmounts(address managerAddress) external override returns(
        uint256 totalBaseReward,
        uint256 totalExtraReward
    ) {
        (totalBaseReward, totalExtraReward) = _claimAmounts(managerAddress);
    }

    function claim() external override {
        address _managerAddress = msg.sender;

        require(
            _managerList.contains(_managerAddress),
            "MicrocreditManager: Invalid manager"
        );

        _createManagerRewardPeriods(_managerAddress);

        Manager storage _manager = _managers[_managerAddress];
        RewardPeriod storage _rewardPeriod;

        uint256 _index;
        uint256 _firstRewardPeriod = _manager.rewardPeriodToClaim;
        uint256 _lastRewardPeriod =  _manager.rewardPeriodsLength - 1;
        uint256 _totalReward;

        for (_index = _firstRewardPeriod; _index < _lastRewardPeriod; _index++) {
            _rewardPeriod = _manager.rewardPeriods[_index];
            _rewardPeriod.extraReward += _calculateExtraReward(_managerAddress, _index);

            _totalReward += _rewardPeriod.baseReward + _rewardPeriod.extraReward;
        }

        require(_totalReward > 0, 'MicrocreditManager: No rewards to claim');

        _manager.rewardPeriodToClaim = _lastRewardPeriod;

        uint256 _claimTokenAmount;
        if (_manager.referenceToken == _manager.claimToken) {
            _claimTokenAmount = _totalReward;
        } else {
            _claimTokenAmount = uniswapQuoter.quoteExactInput(
                abi.encodePacked(
                    _manager.referenceToken,
                    _referenceTokens[_manager.referenceToken].claimTokens[_manager.claimToken].uniswapFee,
                    _manager.claimToken),
                _totalReward
            );
        }

        IERC20(_manager.claimToken).safeTransfer(_managerAddress, _claimTokenAmount);

        emit Claimed(_managerAddress, _firstRewardPeriod, _lastRewardPeriod - 1, _totalReward, _claimTokenAmount);
    }

    function _createManagerRewardPeriods(address _managerAddress) internal {
        Manager storage _manager = _managers[_managerAddress];
        RewardPeriod storage _rewardPeriod = _manager.rewardPeriods[_manager.rewardPeriodsLength - 1];

        while (_rewardPeriod.endDate < block.timestamp) {
            _rewardPeriod = _manager.rewardPeriods[_manager.rewardPeriodsLength];
            _rewardPeriod.startDate = _manager.rewardPeriods[_manager.rewardPeriodsLength - 1].endDate + 1;
            _rewardPeriod.endDate = _rewardPeriod.startDate + _manager.claimDelay - 1;
            _rewardPeriod.baseReward = _manager.baseReward;

            _manager.rewardPeriodsLength++;
        }
    }

    function addCompletedLoanToManager(
        address _managerAddress,
        address _borrowerAddress,
        uint256 _loanId
    ) external override onlyMicrocredit {
        Manager storage _manager = _managers[_managerAddress];

        if (_manager.rewardPeriodsLength == 0) {
            return;
        }

        _createManagerRewardPeriods(_managerAddress);

        RewardPeriod storage _rewardPeriod = _manager.rewardPeriods[_manager.rewardPeriodsLength - 1];

        Loan storage _loan = _rewardPeriod.completedLoans[_rewardPeriod.completedLoansLength];

        _loan.borrowerAddress = _borrowerAddress;
        _loan.borrowerLoanId = _loanId;

        _rewardPeriod.completedLoansLength++;
    }


    function _claimAmounts(address _managerAddress) internal returns (
        uint256 totalBaseReward,
        uint256 totalExtraReward
    ) {
        require(
            _managerList.contains(_managerAddress),
            "ManagerImplementation: Invalid manager"
        );

        Manager storage _manager = _managers[_managerAddress];
        RewardPeriod storage _rewardPeriod;

        uint256 _index;
        for (_index = _manager.rewardPeriodToClaim; _index < _manager.rewardPeriodsLength - 1; _index++) {
            _rewardPeriod = _manager.rewardPeriods[_index];
            totalBaseReward += _rewardPeriod.baseReward;
            totalExtraReward += _calculateExtraReward(_managerAddress, _index);
        }

        _rewardPeriod = _manager.rewardPeriods[_manager.rewardPeriodsLength - 1];
        if (_rewardPeriod.endDate < block.timestamp) {
            totalExtraReward += _calculateExtraReward(_managerAddress, _manager.rewardPeriodsLength);

            uint256 _numberOfNewRewardPeriods = 1 + (block.timestamp - _rewardPeriod.endDate) / _manager.claimDelay;

            totalBaseReward += _numberOfNewRewardPeriods * _manager.baseReward;
        }
    }

    function _calculateExtraReward(
        address _managerAddress,
        uint256 _rewardPeriodIndex
    ) internal returns(uint256) {
        RewardPeriod storage _rewardPeriod = _managers[_managerAddress].rewardPeriods[_rewardPeriodIndex];

        Loan storage _loan;

        uint256 _loanIndex;
        uint256 _totalExtraReward;
        for (_loanIndex = 0; _loanIndex < _rewardPeriod.completedLoansLength; _loanIndex++) {
            _loan = _rewardPeriod.completedLoans[_loanIndex];

            IMicrocredit.UserLoanResponse memory _borrowerLoan =
                                microcredit.userLoans(_loan.borrowerAddress, _loan.borrowerLoanId);

            _totalExtraReward += (_borrowerLoan.amountRepayed - _borrowerLoan.amountRepayed) * rewardPercentage / 100e18;
        }

        return _totalExtraReward;
    }
}
