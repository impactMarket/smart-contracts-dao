//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/MicrocreditStorageV1.sol";

contract MicrocreditImplementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    MicrocreditStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    event LoanAdded(
        address indexed userAddress,
        uint256 loanId,
        uint256 amount,
        uint256 period,
        uint256 dailyInterest,
        uint256 claimDeadline
    );

    event UserAddressChanged(address indexed oldWalletAddress, address indexed newWalletAddress);

    event LoanClaimed(address indexed userAddress, uint256 loanId);

    event RepaymentAdded(
        address indexed userAddress,
        uint256 loanId,
        uint256 repaymentAmount,
        uint256 currentDebt
    );

    modifier onlyManagers() {
        require(_managerList.contains(msg.sender), "Microcredit: caller is not a manager");
        _;
    }

    /**
     * @notice Used to initialize the Microcredit contract
     *
     * @param _cUSDAddress      The address of the cUSD token
     * @param _revenueAddress   The address that collects all the interest
     */
    function initialize(address _cUSDAddress, address _revenueAddress) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        cUSD = IERC20(_cUSDAddress);
        revenueAddress = _revenueAddress;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the information of a user
     *
     * @param _userAddress           address of the user
     * @return userId                the userId
     * @return movedTo               the number of the user's loans
     * @return loansLength           the number of the user's loans
     */
    function walletMetadata(address _userAddress)
        external
        view
        override
        returns (
            uint256 userId,
            address movedTo,
            uint256 loansLength
        )
    {
        WalletMetadata memory _metadata = _walletMetadata[_userAddress];

        userId = _metadata.userId;
        movedTo = _metadata.movedTo;
        loansLength = _users[_metadata.userId].loans.length;
    }

    /**
     * @notice Returns the length of the walletList
     */
    function walletListLength() external view override returns (uint256) {
        return _walletList.length();
    }

    /**
     * @notice Returns an address from the walletList
     *
     * @param _index index value
     * @return address of the user
     */
    function walletListAt(uint256 _index) external view override returns (address) {
        return _walletList.at(_index);
    }

    /**
     * @notice Returns an address from the managerList
     *
     * @param _index index value
     * @return address of the manager
     */
    function managerListAt(uint256 _index) external view override returns (address) {
        return _managerList.at(_index);
    }

    /**
     * @notice Returns the length of the managerList
     */
    function managerListLength() external view override returns (uint256) {
        return _managerList.length();
    }

    function userLoans(address _userAddress, uint256 _loanId)
        external
        view
        override
        returns (
            uint256 amountBorrowed,
            uint256 period,
            uint256 dailyInterest,
            uint256 claimDeadline,
            uint256 startDate,
            uint256 currentDebt,
            uint256 lastComputedDebt,
            uint256 amountRepayed,
            uint256 repaymentsLength,
            uint256 lastComputedDate
        )
    {
        _checkUserLoan(_userAddress, _loanId);

        WalletMetadata memory _metadata = _walletMetadata[_userAddress];
        User memory _user = _users[_metadata.userId];
        Loan memory _loan = _user.loans[_loanId];

        amountBorrowed = _loan.amountBorrowed;
        period = _loan.period;
        dailyInterest = _loan.dailyInterest;
        claimDeadline = _loan.claimDeadline;
        startDate = _loan.startDate;
        lastComputedDebt = _loan.lastComputedDebt;
        currentDebt = _calculateCurrentDebt(_loan);
        amountRepayed = _loan.amountRepayed;
        repaymentsLength = _loan.repayments.length;
        lastComputedDate = _getLastComputedDate(_loan);
    }

    function userLoanRepayments(
        address _userAddress,
        uint256 _loanId,
        uint256 _repaymentId
    ) external view override returns (uint256 date, uint256 amount) {
        _checkUserLoan(_userAddress, _loanId);

        WalletMetadata memory _metadata = _walletMetadata[_userAddress];
        User memory _user = _users[_metadata.userId];
        Loan memory _loan = _user.loans[_loanId];

        require(_loan.repayments.length > _repaymentId, "Microcredit: Repayment doesn't exist");

        date = _loan.repayments[_repaymentId].date;
        amount = _loan.repayments[_repaymentId].amount;
    }

    function updateRevenueAddress(address _newRevenueAddress) external override onlyOwner {
        revenueAddress = _newRevenueAddress;
    }

    function addManagers(address[] calldata _managerAddresses) external override onlyOwner {
        uint256 _length = _managerAddresses.length;
        uint256 _index;

        for (_index = 0; _index < _length; _index++) {
            _managerList.add(_managerAddresses[_index]);
        }
    }

    function removeManagers(address[] calldata _managerAddresses) external override onlyOwner {
        uint256 _length = _managerAddresses.length;
        uint256 _index;

        for (_index = 0; _index < _length; _index++) {
            _managerList.remove(_managerAddresses[_index]);
        }
    }

    function addLoan(
        address _userAddress,
        uint256 _amount,
        uint256 _period,
        uint256 _dailyInterest,
        uint256 _claimDeadline
    ) external override onlyManagers {
        _addLoan(_userAddress, _amount, _period, _dailyInterest, _claimDeadline);
    }

    function addLoans(
        address[] calldata _userAddresses,
        uint256[] calldata _amounts,
        uint256[] calldata _periods,
        uint256[] calldata _dailyInterests,
        uint256[] calldata _claimDeadlines
    ) external override onlyManagers {
        uint256 _loansNumber = _userAddresses.length;
        require(
            _loansNumber == _amounts.length,
            "Microcredit: calldata information arity mismatch"
        );
        require(
            _loansNumber == _periods.length,
            "Microcredit: calldata information arity mismatch"
        );
        require(
            _loansNumber == _dailyInterests.length,
            "Microcredit: calldata information arity mismatch"
        );
        require(
            _loansNumber == _claimDeadlines.length,
            "Microcredit: calldata information arity mismatch"
        );

        uint256 _index;

        for (_index = 0; _index < _loansNumber; _index++) {
            _addLoan(
                _userAddresses[_index],
                _amounts[_index],
                _periods[_index],
                _dailyInterests[_index],
                _claimDeadlines[_index]
            );
        }
    }

    function changeUserAddress(address _oldWalletAddress, address _newWalletAddress)
        external
        override
        onlyManagers
    {
        WalletMetadata storage _oldWalletMetadata = _walletMetadata[_oldWalletAddress];
        require(
            _oldWalletMetadata.userId > 0 && _oldWalletMetadata.movedTo == address(0),
            "Microcredit: This user cannot be moved"
        );

        WalletMetadata storage _newWalletMetadata = _walletMetadata[_newWalletAddress];
        require(_newWalletMetadata.userId == 0, "Microcredit: Target wallet address is invalid");

        _oldWalletMetadata.movedTo = _newWalletAddress;
        _newWalletMetadata.userId = _oldWalletMetadata.userId;

        _walletList.add(_newWalletAddress);

        emit UserAddressChanged(_oldWalletAddress, _newWalletAddress);
    }

    function claimLoan(uint256 _loanId) external override nonReentrant {
        _checkUserLoan(msg.sender, _loanId);

        WalletMetadata memory _metadata = _walletMetadata[msg.sender];
        User storage _user = _users[_metadata.userId];
        Loan storage _loan = _user.loans[_loanId];

        require(_loan.startDate == 0, "Microcredit: Loan already claimed");
        require(_loan.claimDeadline >= block.timestamp, "Microcredit: Loan expired");

        _loan.startDate = block.timestamp;
        _loan.lastComputedDebt = _loan.amountBorrowed;

        cUSD.safeTransfer(msg.sender, _loan.amountBorrowed);

        emit LoanClaimed(msg.sender, _loanId);
    }

    function repayLoan(uint256 _loanId, uint256 _repaymentAmount) external override nonReentrant {
        require(_repaymentAmount > 0, "Microcredit: Invalid amount");

        _checkUserLoan(msg.sender, _loanId);

        WalletMetadata memory _metadata = _walletMetadata[msg.sender];
        User storage _user = _users[_metadata.userId];
        Loan storage _loan = _user.loans[_loanId];

        require(_loan.startDate > 0, "Microcredit: Loan not claimed");
        require(_loan.lastComputedDebt > 0, "Microcredit: Loan has already been fully repayed");

        uint256 _currentDebt = _calculateCurrentDebt(_loan);

        if (_currentDebt < _repaymentAmount) {
            _repaymentAmount = _currentDebt;
        }

        uint256 _revenueAmount;
        uint256 _loanAmount;

        if (
            _loan.amountRepayed + _repaymentAmount <= _loan.amountBorrowed ||
            revenueAddress == address(0)
        ) {
            //all repaymentAmount should go to microcredit address
            cUSD.safeTransferFrom(msg.sender, address(this), _repaymentAmount);
        } else if (_loan.amountRepayed >= _loan.amountBorrowed) {
            //all repaymentAmount should go to revenue address
            cUSD.safeTransferFrom(msg.sender, revenueAddress, _repaymentAmount);
        } else {
            //a part of the repayment should go to microcredit address and the rest should go to the revenue address
            uint256 _loanDiff = _loan.amountBorrowed - _loan.amountRepayed;
            cUSD.safeTransferFrom(msg.sender, address(this), _loanDiff);
            cUSD.safeTransferFrom(msg.sender, revenueAddress, _repaymentAmount - _loanDiff);
        }

        Repayment storage _repayment = _loan.repayments.push();
        _repayment.date = block.timestamp;
        _repayment.amount = _repaymentAmount;

        _loan.lastComputedDebt = _currentDebt - _repaymentAmount;
        _loan.amountRepayed += _repaymentAmount;

        emit RepaymentAdded(msg.sender, _loanId, _repaymentAmount, _loan.lastComputedDebt);
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param _token address of the ERC20 token
     * @param _to address of the receiver
     * @param _amount amount of the transaction
     */
    function transferERC20(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external override nonReentrant onlyOwner {
        _token.safeTransfer(_to, _amount);
    }

    function _checkUserLoan(address _userAddress, uint256 _loanId) internal view {
        WalletMetadata memory _metadata = _walletMetadata[_userAddress];

        require(
            _metadata.userId > 0 && _metadata.movedTo == address(0),
            "Microcredit: Invalid wallet address"
        );

        User memory _user = _users[_metadata.userId];

        require(_user.loans.length > _loanId, "Microcredit: Loan doesn't exist");
    }

    function _getLastComputedDate(Loan memory _loan) internal view returns (uint256) {
        return
            _loan.repayments.length > 0
                ? _loan.repayments[_loan.repayments.length - 1].date
                : _loan.startDate;
    }

    function _calculateCurrentDebt(Loan memory _loan) internal view returns (uint256) {
        if (_loan.lastComputedDebt == 0) {
            return 0;
        }

        uint256 _lastPaymentDate = _getLastComputedDate(_loan);

        uint256 _days = (block.timestamp - _lastPaymentDate) / 86400; //86400 = 1 day in seconds

        uint256 _currentDebt = _loan.lastComputedDebt;

        while (_days > 0) {
            _currentDebt = (_currentDebt * (1e18 + _loan.dailyInterest / 100)) / 1e18;
            _days--;
        }

        return _currentDebt;
    }

    function _addLoan(
        address _userAddress,
        uint256 _amount,
        uint256 _period,
        uint256 _dailyInterest,
        uint256 _claimDeadline
    ) internal {
        require(_claimDeadline > block.timestamp, "Microcredit: invalid claimDeadline");

        WalletMetadata storage _metadata = _walletMetadata[_userAddress];
        require(_metadata.movedTo == address(0), "Microcredit: The user has been moved");

        if (_metadata.userId == 0) {
            _usersLength++;
            _metadata.userId = _usersLength;
            _walletList.add(_userAddress);
        }

        User storage _user = _users[_metadata.userId];

        uint256 _loansLength = _user.loans.length;

        if (_loansLength > 0) {
            Loan memory _previousLoan = _user.loans[_loansLength - 1];
            require(
                (_previousLoan.startDate > 0 && _previousLoan.lastComputedDebt == 0) || // loan claimed and fully paid
                    (_previousLoan.startDate == 0 && _previousLoan.claimDeadline < block.timestamp), //loan unclaimed and expired
                "Microcredit: The user already has an active loan"
            );
        }

        Loan storage _loan = _user.loans.push();

        _loan.amountBorrowed = _amount;
        _loan.period = _period;
        _loan.dailyInterest = _dailyInterest;
        _loan.claimDeadline = _claimDeadline;

        emit LoanAdded(
            _userAddress,
            _user.loans.length - 1,
            _amount,
            _period,
            _dailyInterest,
            _claimDeadline
        );
    }
}
