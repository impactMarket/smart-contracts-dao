//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/TreasuryLpSwapStorageV1.sol";

contract TreasuryLpSwapImplementation is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    TreasuryLpSwapStorageV1
{
    using SafeERC20Upgradeable for IERC20;

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Triggered when a LP has been increased
     *
     * @param uniswapNFTPositionManagerId       Position manager tokenId
     * @param pactToAdd                         Amount of PACT that should have been added in LP
     * @param tokenToAdd                        Amount of token that should have been added in LP
     * @param pactSpent                         Amount of PACT that have been added in LP
     * @param tokenSpent                        Amount of token that have been added in LP
     */
    event LiquidityIncreased(
        uint256 uniswapNFTPositionManagerId,
        uint256 pactToAdd,
        uint256 tokenToAdd,
        uint256 pactSpent,
        uint256 tokenSpent
    );

    /**
     * @notice Triggered when a LP has been decreased
     *
     * @param uniswapNFTPositionManagerId           Position manager tokenId
     * @param liquidityDecreased                    Liquidity amount that was decreased from LP
     * @param liquidityLeft                         Liquidity amount that was left in LP
     * @param pactDecreased                         Amount of PACT that was decreased from LP
     * @param tokenDecreased                        Amount of token that was decreased from LP
     */
    event LiquidityDecreased(
        uint256 uniswapNFTPositionManagerId,
        uint256 liquidityDecreased,
        uint256 liquidityLeft,
        uint256 pactDecreased,
        uint256 tokenDecreased
    );

    /**
     * @notice Triggered when the fees of an LP has been decreased
     *
     * @param uniswapNFTPositionManagerId     Position manager tokenId
     * @param pactFee                         pactFee
     * @param tokenFee                        tokenFee
     */
    event FeesCollected(uint256 uniswapNFTPositionManagerId, uint256 pactFee, uint256 tokenFee);

    /**
     * @notice Triggered when a token has been set
     *
     * @param tokenAddress           Address of the token
     * @param amountIn               Amount changed
     * @param amountOutMin           Minimum amount out
     * @param exchangePath           Exchange path
     * @param amountsOut             Value of the final amount out
     */
    event AmountConverted(
        address indexed tokenAddress,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes exchangePath,
        uint256 amountsOut
    );

    //todo: remove this modifier after deployment and testing
    /**
     * @notice Enforces sender to DAO or impactMarketCouncil
     */
    modifier onlyOwnerOrImpactMarketCouncil() {
        require(
            msg.sender == owner() ||
                msg.sender == address(treasury.communityAdmin().impactMarketCouncil()),
            "TreasuryLpSwap: caller is not the owner nor ImpactMarketCouncil"
        );
        _;
    }

    /**
     * @notice Enforces sender to Treasury
     */
    modifier onlyTreasury() {
        require(msg.sender == address(treasury), "TreasuryLpSwap: caller is not the treasury");
        _;
    }

    function initialize(
        ITreasury _treasury,
        IUniswapRouter02 _uniswapRouter,
        IQuoter _uniswapQuoter,
        INonfungiblePositionManager _uniswapNFTPositionManager
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        treasury = _treasury;
        uniswapRouter = _uniswapRouter;
        uniswapQuoter = _uniswapQuoter;
        uniswapNFTPositionManager = _uniswapNFTPositionManager;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Updates the Treasury contract address
     *
     * @param _newTreasury address of the new Treasury contract
     */
    function updateTreasury(ITreasury _newTreasury)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        treasury = _newTreasury;
    }

    /**
     * @notice Updates the UniswapRouter contract address
     *
     * @param _newUniswapRouter address of the new UniswapRouter contract
     */
    function updateUniswapRouter(IUniswapRouter02 _newUniswapRouter)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        uniswapRouter = _newUniswapRouter;
    }

    /**
     * @notice Updates the UniswapQuoter contract address
     *
     * @param _newUniswapQuoter address of the new UniswapQuoter contract
     */
    function updateUniswapQuoter(IQuoter _newUniswapQuoter)
        external
        override
        onlyOwnerOrImpactMarketCouncil
    {
        uniswapQuoter = _newUniswapQuoter;
    }

    /**
     * @notice Updates the UniswapNFTPositionManager contract address
     *
     * @param _newUniswapNFTPositionManager address of the new UniswapNFTPositionManager contract
     */
    function updateUniswapNFTPositionManager(
        INonfungiblePositionManager _newUniswapNFTPositionManager
    ) external override onlyOwnerOrImpactMarketCouncil {
        uniswapNFTPositionManager = _newUniswapNFTPositionManager;
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param _token address of the ERC20 token
     * @param _to address of the receiver
     * @param _amount amount of the transaction
     */
    function transfer(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner nonReentrant {
        _token.safeTransfer(_to, _amount);

        emit TransferERC20(address(_token), _to, _amount);
    }

    /**
     * @notice Converts an amount of a token to another token
     *
     * @param _tokenAddress address of the token to convert
     * @param _amountIn amount of the token to convert
     * @param _amountOutMin minimum amount of the token to receive
     * @param _exchangePath exchange path - if empty, it will use the default exchange path
     */
    function convertAmount(
        address _tokenAddress,
        uint256 _amountIn,
        uint256 _amountOutMin,
        bytes memory _exchangePath
    ) external override onlyOwnerOrImpactMarketCouncil {
        require(
            treasury.isToken(_tokenAddress),
            "TreasuryLpSwap::convertAmount: this is not a valid token"
        );

        if (_exchangePath.length == 0) {
            (, , , , , bytes memory _exchangePathToCUSD, ) = treasury.tokens(_tokenAddress);
            _exchangePath = _exchangePathToCUSD;
        }

        IERC20(_tokenAddress).approve(address(uniswapRouter), _amountIn);

        // Executes the swap.
        uint256 _amountOut = uniswapRouter.exactInput(
            IUniswapRouter02.ExactInputParams({
                path: _exchangePath,
                recipient: address(this),
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMin
            })
        );

        emit AmountConverted(_tokenAddress, _amountIn, _amountOutMin, _exchangePath, _amountOut);
    }

    /**
     * @notice Adds tokens to lp
     *
     * @param _erc20Token address of the ERC20 token
     * @param _amount amount to be added in lp
     */
    function addToLp(IERC20 _erc20Token, uint256 _amount) external override nonReentrant {
        if (_amount == 0) {
            return;
        }

        _erc20Token.safeTransferFrom(msg.sender, address(this), _amount);

        (
            ,
            ,
            ,
            ,
            uint256 _uniswapNFTPositionManagerId,
            ,
            bytes memory _exchangePathToPACT
        ) = treasury.tokens(address(_erc20Token));

        uint256 _tokenAmountToAdd = _amount / 2;
        _erc20Token.approve(address(uniswapRouter), _tokenAmountToAdd);

        uint256 _pactAmountToAdd = uniswapRouter.exactInput(
            IUniswapRouter02.ExactInputParams({
                path: _exchangePathToPACT,
                recipient: address(this),
                amountIn: _tokenAmountToAdd,
                amountOutMinimum: 0
            })
        );

        uint256 _initialPACTBalance = treasury.PACT().balanceOf(address(this));
        uint256 _initialTokenBalance = _erc20Token.balanceOf(address(this));

        uint256 _amount0;
        uint256 _amount1;

        if (address(treasury.PACT()) < address(_erc20Token)) {
            _amount0 = _pactAmountToAdd;
            _amount1 = _tokenAmountToAdd;
        } else {
            _amount0 = _tokenAmountToAdd;
            _amount1 = _pactAmountToAdd;
        }

        treasury.PACT().approve(address(uniswapNFTPositionManager), _pactAmountToAdd);
        _erc20Token.approve(address(uniswapNFTPositionManager), _tokenAmountToAdd);

        uniswapNFTPositionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: _uniswapNFTPositionManagerId,
                amount0Desired: _amount0,
                amount1Desired: _amount1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        uint256 _pactSpent = _initialPACTBalance - treasury.PACT().balanceOf(address(this));
        uint256 _tokenSpent = _initialTokenBalance - _erc20Token.balanceOf(address(this));

        emit LiquidityIncreased(
            _uniswapNFTPositionManagerId,
            _pactAmountToAdd,
            _tokenAmountToAdd,
            _pactSpent,
            _tokenSpent
        );
    }

    /**
     * @notice Collects fees from lp
     *
     * @param _uniswapNFTPositionManagerId id of the lp
     */
    function collectFees(uint256 _uniswapNFTPositionManagerId)
        external
        override
        onlyTreasury
        returns (uint256 amount0, uint256 amount1)
    {
        (amount0, amount1) = uniswapNFTPositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: _uniswapNFTPositionManagerId,
                recipient: address(treasury),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        (, , address _token0Address, , , , , , , , , ) = uniswapNFTPositionManager.positions(
            _uniswapNFTPositionManagerId
        );

        if (_token0Address == address(treasury.PACT())) {
            emit FeesCollected(_uniswapNFTPositionManagerId, amount0, amount1);
        } else {
            emit FeesCollected(_uniswapNFTPositionManagerId, amount1, amount0);
        }
    }

    function decreaseLiquidity(uint256 _uniswapNFTPositionManagerId, uint128 _liquidityAmount)
        external
        override
        onlyOwnerOrImpactMarketCouncil
        returns (uint256 amount0, uint256 amount1)
    {
        (amount0, amount1) = uniswapNFTPositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: _uniswapNFTPositionManagerId,
                liquidity: _liquidityAmount,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        (
            ,
            ,
            address _token0Address,
            ,
            ,
            ,
            ,
            uint256 _liquidityLeft,
            ,
            ,
            ,

        ) = uniswapNFTPositionManager.positions(_uniswapNFTPositionManagerId);

        if (_token0Address == address(treasury.PACT())) {
            emit LiquidityDecreased(
                _uniswapNFTPositionManagerId,
                _liquidityAmount,
                _liquidityLeft,
                amount0,
                amount1
            );
        } else {
            emit LiquidityDecreased(
                _uniswapNFTPositionManagerId,
                _liquidityAmount,
                _liquidityLeft,
                amount1,
                amount0
            );
        }
    }
}
