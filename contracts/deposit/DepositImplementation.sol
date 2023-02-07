//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/DepositStorageV1.sol";
import "../externalInterfaces/aave/IAToken.sol";

contract DepositImplementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    DepositStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Triggered when a token has been added
     *
     * @param tokenAddress        Address of the token
     */
    event TokenAdded(address indexed tokenAddress);

    /**
     * @notice Triggered when a token has been removed
     *
     * @param tokenAddress        Address of the token
     */
    event TokenRemoved(address indexed tokenAddress);

    /**
     * @notice Triggered when the treasury address has been updated
     *
     * @param oldTreasury             Old treasury address
     * @param newTreasury             New treasury address
     */
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Triggered when the donationMiner address has been updated
     *
     * @param oldDonationMiner             Old donationMiner address
     * @param newDonationMiner             New donationMiner address
     */
    event DonationMinerUpdated(address indexed oldDonationMiner, address indexed newDonationMiner);

    /**
     * @notice Triggered when LendingPool has been updated
     *
     * @param oldLendingPool   Old lendingPool address
     * @param newLendingPool   New lendingPool address
     */
    event LendingPoolUpdated(address indexed oldLendingPool, address indexed newLendingPool);

    /**
     * @notice Triggered when an amount of an ERC20 has been deposited
     *
     * @param depositorAddress    The address of the depositor that makes the deposit
     * @param token               ERC20 token address
     * @param amount              Amount of the deposit
     */
    event DepositAdded(address indexed depositorAddress, address indexed token, uint256 amount);

    /**
     * @notice Triggered when an amount of an ERC20 has been withdrawn
     *
     * @param depositorAddress    The address of the depositor that makes the withdrawal
     * @param token               ERC20 token address
     * @param amount              Amount of the withdrawal
     * @param interest            Interest earned (and donated to DonationMiner)
     */
    event Withdraw(
        address indexed depositorAddress,
        address indexed token,
        uint256 amount,
        uint256 interest
    );

    /**
     * @notice Triggered when the interest of an amount of an ERC20 has been donated
     *
     * @param depositorAddress    The address of the depositor
     * @param token               ERC20 token address
     * @param amount              Amount of the withdrawal
     * @param interest            Interest earned (and donated to DonationMiner)
     */
    event DonateInterest(
        address indexed depositorAddress,
        address indexed token,
        uint256 amount,
        uint256 interest
    );

    /**
     * @notice Used to initialize a new DonationMiner contract
     *
     * @param _treasury             Address of the Treasury
     * @param _lendingPool          Address of the LendingPool
     */
    function initialize(
        ITreasury _treasury,
        IDonationMiner _donationMiner,
        ILendingPool _lendingPool,
        address[] memory _tokenListAddresses
    ) public initializer {
        require(address(_treasury) != address(0), "Deposit::initialize: invalid _treasury address");
        require(
            address(_lendingPool) != address(0),
            "Deposit::initialize: invalid _lendingPool address"
        );

        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        treasury = _treasury;
        donationMiner = _donationMiner;
        lendingPool = _lendingPool;

        uint256 _index;
        uint256 _numberOfTokens = _tokenListAddresses.length;
        for (; _index < _numberOfTokens; _index++) {
            _tokenList.add(_tokenListAddresses[_index]);

            IERC20(_tokenListAddresses[_index]).approve(address(lendingPool), type(uint256).max);
            IERC20(_tokenListAddresses[_index]).approve(address(donationMiner), type(uint256).max);

            emit TokenAdded(_tokenListAddresses[_index]);
        }
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    function token(address _tokenAddress)
        external
        view
        override
        returns (uint256 totalAmount, uint256 depositorListLength)
    {
        Token storage _token = _tokens[_tokenAddress];

        return (_token.totalAmount, _token.depositorList.length());
    }

    function tokenDepositorListAt(address _tokenAddress, uint256 _index)
        external
        view
        override
        returns (address)
    {
        return _tokens[_tokenAddress].depositorList.at(_index);
    }

    /**
     * @notice Returns the number of tokens
     *
     * @return uint256 number of tokens
     */
    function tokenListLength() external view override returns (uint256) {
        return _tokenList.length();
    }

    /**
     * @notice Returns the address of a token from tokenList
     *
     * @param _index index of the token
     * @return address of the token
     */
    function tokenListAt(uint256 _index) external view override returns (address) {
        return _tokenList.at(_index);
    }

    /**
     * @notice Returns if an address is an accepted token
     *
     * @param _tokenAddress token address to be checked
     * @return bool true if the tokenAddress is an accepted token
     */
    function isToken(address _tokenAddress) public view override returns (bool) {
        return _tokenList.contains(_tokenAddress);
    }

    function tokenDepositor(address _tokenAddress, address _depositorAddress)
        external
        view
        override
        returns (uint256 amount, uint256 scaledBalance)
    {
        Depositor memory _depositor = _tokens[_tokenAddress].depositors[_depositorAddress];

        return (_depositor.amount, _depositor.scaledBalance);
    }

    /**
     * @notice Updates Treasury address
     *
     * @param _newTreasury address of new treasury contract
     */
    function updateTreasury(ITreasury _newTreasury) external override onlyOwner {
        emit TreasuryUpdated(address(treasury), address(_newTreasury));
        treasury = _newTreasury;
    }

    /**
     * @notice Updates DonationMiner address
     *
     * @param _newDonationMiner address of new donationMiner contract
     */
    function updateDonationMiner(IDonationMiner _newDonationMiner) external override onlyOwner {
        emit DonationMinerUpdated(address(donationMiner), address(_newDonationMiner));
        donationMiner = _newDonationMiner;
    }

    /**
     * @notice Updates the LendingPool contract address
     *
     * @param _newLendingPool address of the new LendingPool contract
     */
    function updateLendingPool(ILendingPool _newLendingPool) external override onlyOwner {
        emit LendingPoolUpdated(address(lendingPool), address(_newLendingPool));
        lendingPool = _newLendingPool;
    }

    function addToken(address _tokenAddress) public override onlyOwner {
        require(!isToken(_tokenAddress), "Deposit::addToken: token already added");
        require(
            treasury.isToken(_tokenAddress),
            "Deposit::addToken: it must be a valid treasury token"
        );

        require(
            lendingPool.getReserveData(_tokenAddress).aTokenAddress != address(0),
            "Deposit::addToken: it must be a valid lendingPool token"
        );

        _tokenList.add(_tokenAddress);

        IERC20(_tokenAddress).approve(address(lendingPool), type(uint256).max);
        IERC20(_tokenAddress).approve(address(donationMiner), type(uint256).max);

        emit TokenAdded(_tokenAddress);
    }

    function removeToken(address _tokenAddress) external override onlyOwner {
        require(isToken(_tokenAddress), "Deposit::removeToken: this is not a token");

        _tokenList.remove(_tokenAddress);
        emit TokenRemoved(_tokenAddress);
    }

    function deposit(address _tokenAddress, uint256 _amount)
        external
        override
        whenNotPaused
        nonReentrant
    {
        require(isToken(_tokenAddress), "Deposit::deposit: this is not a token");
        require(_amount > 0, "Deposit::deposit: invalid amount");

        IERC20Upgradeable(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        IAToken aToken = IAToken(lendingPool.getReserveData(_tokenAddress).aTokenAddress);

        uint256 _beforeScaledBalance = aToken.scaledBalanceOf(address(this));
        lendingPool.deposit(_tokenAddress, _amount, address(this), 0);

        uint256 _afterScaledBalance = aToken.scaledBalanceOf(address(this));

        Token storage _token = _tokens[_tokenAddress];
        _token.depositorList.add(msg.sender);
        _token.totalAmount += _amount;

        Depositor storage _depositor = _token.depositors[msg.sender];
        _depositor.amount += _amount;
        _depositor.scaledBalance += _afterScaledBalance - _beforeScaledBalance;

        emit DepositAdded(msg.sender, _tokenAddress, _amount);
    }

    function withdraw(address _tokenAddress, uint256 _amount)
        external
        override
        whenNotPaused
        nonReentrant
    {
        Token storage _token = _tokens[_tokenAddress];
        Depositor storage _depositor = _token.depositors[msg.sender];

        require(_amount <= _depositor.amount, "Deposit::withdraw: invalid amount");

        if (_amount == _depositor.amount) {
            _token.depositorList.remove(msg.sender);
        }

        IAToken aToken = IAToken(lendingPool.getReserveData(_tokenAddress).aTokenAddress);

        uint256 _beforeScaledBalance = aToken.scaledBalanceOf(address(this));
        uint256 _withdrawScaledBalanceShare = (_amount * _depositor.scaledBalance) /
            _depositor.amount;
        uint256 _withdrawBalanceShare = (_withdrawScaledBalanceShare *
            aToken.balanceOf(address(this))) / _beforeScaledBalance;

        uint256 _interest = _withdrawBalanceShare - _amount;

        lendingPool.withdraw(_tokenAddress, _amount, msg.sender);
        lendingPool.withdraw(_tokenAddress, _interest, address(this));
        donationMiner.donate(IERC20(_tokenAddress), _interest, msg.sender);

        _token.totalAmount -= _amount;
        _depositor.amount -= _amount;
        _depositor.scaledBalance -= _withdrawScaledBalanceShare;

        //        uint256 _afterScaledBalance = aToken.scaledBalanceOf(address(this));
        //        uint256 _diffScaledBalance = _beforeScaledBalance - _afterScaledBalance;
        //        uint256 _interest = _diffScaledBalance * aToken.balanceOf(address(this)) / _afterScaledBalance;
        //
        //        console.log('_beforeScaledBalance: ', _beforeScaledBalance);
        //        console.log('_afterScaledBalance: ', _afterScaledBalance);
        //        console.log('_diffScaledBalance1: ', _diffScaledBalance);
        //        console.log('_diffScaledBalance2: ', _withdrawScaledBalanceShare);
        //        console.log('balance: ', aToken.balanceOf(address(this)));
        //        console.log('_interest1: ', _interest);
        //        console.log('_interest2: ', (_diffScaledBalance *  lendingPool.getReserveNormalizedIncome(_tokenAddress) + 1e27/2) / 1e27);
        //        console.log('lendingPool.getReserveNormalizedIncome(address(aToken): ', lendingPool.getReserveNormalizedIncome(_tokenAddress));
        //        console.log('_withdrawBalanceShare: ', _withdrawBalanceShare);

        emit Withdraw(msg.sender, _tokenAddress, _amount, _interest);
    }

    function donateInterest(
        address _depositorAddress,
        address _tokenAddress,
        uint256 _amount
    ) external override whenNotPaused nonReentrant {
        Token storage _token = _tokens[_tokenAddress];
        Depositor storage _depositor = _token.depositors[_depositorAddress];

        require(_amount <= _depositor.amount, "Deposit::donateInterest: invalid amount");

        IAToken aToken = IAToken(lendingPool.getReserveData(_tokenAddress).aTokenAddress);

        uint256 _beforeScaledBalance = aToken.scaledBalanceOf(address(this));
        uint256 _withdrawScaledBalanceShare = (_amount * _depositor.scaledBalance) /
            _depositor.amount;
        uint256 _withdrawBalanceShare = (_withdrawScaledBalanceShare *
            aToken.balanceOf(address(this))) / _beforeScaledBalance;

        uint256 _interest = _withdrawBalanceShare - _amount;

        lendingPool.withdraw(_tokenAddress, _interest, address(this));

        uint256 _afterScaledBalance = aToken.scaledBalanceOf(address(this));

        donationMiner.donate(IERC20(_tokenAddress), _interest, _depositorAddress);

        _depositor.scaledBalance -= _beforeScaledBalance - _afterScaledBalance;

        emit DonateInterest(_depositorAddress, _tokenAddress, _amount, _interest);
    }

    function interest(
        address _depositorAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view override returns (uint256) {
        Token storage _token = _tokens[_tokenAddress];
        Depositor storage _depositor = _token.depositors[_depositorAddress];

        require(_amount <= _depositor.amount, "Deposit::donateInterest: invalid amount");

        IAToken aToken = IAToken(lendingPool.getReserveData(_tokenAddress).aTokenAddress);

        uint256 _beforeScaledBalance = aToken.scaledBalanceOf(address(this));
        uint256 _withdrawScaledBalanceShare = (_amount * _depositor.scaledBalance) /
            _depositor.amount;
        uint256 _withdrawBalanceShare = (_withdrawScaledBalanceShare *
            aToken.balanceOf(address(this))) / _beforeScaledBalance;

        return _withdrawBalanceShare - _amount;
    }
}
