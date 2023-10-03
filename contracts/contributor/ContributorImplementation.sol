//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/ContributorStorageV1.sol";

import "hardhat/console.sol";

contract ContributorImplementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ContributorStorageV1
{
    using SafeERC20Upgradeable for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant BASE_PERIOD = 1 days;

    /**
     * @notice Triggered when a contributor has been added
     *
     * @param contributor           Address of the contributor
     * @param dailyPaymentAmount    amount of cUSD (in PACT) to be added as reward for a contributor every day
     * @param startPeriod           timestamp when the user became a contributor
     */
    event ContributorAdded(
        address indexed contributor,
        uint256 dailyPaymentAmount,
        uint256 startPeriod
    );

    /**
     * @notice Triggered after a claim
     *
     * @param contributor         The address of the contributor that has claimed
     * @param amount              The amount of the claim
     */
    event Claimed(address indexed contributor, uint256 amount);

    /**
     * @notice Used to initialize a new Contributor contract
     *
     * @param _PACT                     The address of the PACT token
     * @param _uniswapQuoter            The address of the UniswapQuoter
     * @param _exchangePathCUSDToPACT   The exchange path
     * @param _claimDelay              The period of time between two contributor's claim
     */
    function initialize(
        IERC20 _PACT,
        IQuoter _uniswapQuoter,
        bytes calldata _exchangePathCUSDToPACT,
        uint256 _claimDelay
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        PACT = _PACT;
        uniswapQuoter = _uniswapQuoter;
        exchangePathCUSDToPACT = _exchangePathCUSDToPACT;

        console.log('BASE_PERIOD', BASE_PERIOD);
        console.log('claimDelay', _claimDelay);
        console.log('_claimDelay / BASE_PERIOD', _claimDelay / BASE_PERIOD);
        console.log('_claimDelay / BASE_PERIOD', _claimDelay / BASE_PERIOD);
        require(
            _claimDelay > 0 && (_claimDelay / BASE_PERIOD) * BASE_PERIOD == _claimDelay,
            "ContributorImplementation: Invalid claimDelay"
        );
        claimDelay = _claimDelay;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the length of the contributorList
     */
    function contributorListLength() external view override returns (uint256) {
        return contributorList.length();
    }

    /**
     * @notice Returns an address from the contributorList
     *
     * @param index_ index value
     * @return address of the contributor
     */
    function contributorListAt(uint256 index_) external view override returns (address) {
        return contributorList.at(index_);
    }

    /**
     * @notice Adds a new contributor
     *
     * @param _contributorAddress     address of the contributor
     * @param _dailyPaymentAmount     amount of cUSD (in PACT) to be added as reward for contributor every day
     * @param _startPeriod            timestamp when the user became a contributor (let 0 if today)
     */
    function addContributor(
        address _contributorAddress,
        uint256 _dailyPaymentAmount,
        uint256 _startPeriod
    ) external onlyOwner {
        Contributor storage _contributor = contributors[_contributorAddress];

        require(
            _contributor.dailyPaymentAmount == 0,
            "ContributorImplementation: Contributor already added"
        );

        _contributor.dailyPaymentAmount = _dailyPaymentAmount;

        if (_startPeriod == 0) {
            _contributor.lastClaimTime = block.timestamp;
        } else {
            require(
                (block.timestamp - _startPeriod) < 90 days,
                "ContributorImplementation: start date cannot be more than 90 days in the past"
            );
            _contributor.lastClaimTime = _startPeriod;
        }
        contributorList.add(_contributorAddress);

        emit ContributorAdded(_contributorAddress, _dailyPaymentAmount, _contributor.lastClaimTime);
    }

    function claim(address _contributorAddress) external override {
        Contributor storage _contributor = contributors[_contributorAddress];

        require(
            _contributor.dailyPaymentAmount > 0,
            "ContributorImplementation: Invalid contributor"
        );

        require(
            _contributor.lastClaimTime + claimDelay <= block.timestamp,
            "ContributorImplementation: You don't have funds to claim yet"
        );

        uint256 _periodsToClaim = (block.timestamp - _contributor.lastClaimTime) / claimDelay;
        uint256 _onePeriodReward = _contributor.dailyPaymentAmount * (claimDelay / BASE_PERIOD);

        uint256 _paymentAmount = _periodsToClaim * _onePeriodReward;

        _contributor.lastClaimTime = _contributor.lastClaimTime + _periodsToClaim * claimDelay;


        uint256 _convertedAmount =  uniswapQuoter.quoteExactInput(exchangePathCUSDToPACT, 1e18) * _paymentAmount / 1e18;

        _contributor.claimedAmount += _convertedAmount;

        PACT.safeTransfer(_contributorAddress, _convertedAmount);
    }

    function claimAmount(address _contributorAddress) external override returns (uint256) {
        Contributor memory _contributor = contributors[_contributorAddress];

        require(
            _contributor.dailyPaymentAmount > 0,
            "ContributorImplementation: Invalid contributor"
        );

        if (_contributor.lastClaimTime + claimDelay > block.timestamp) {
            return 0;
        }

        uint256 _periodsToClaim = (block.timestamp - _contributor.lastClaimTime) / claimDelay;
        uint256 _onePeriodReward = _contributor.dailyPaymentAmount * (claimDelay / BASE_PERIOD);

        uint256 _paymentAmount = _periodsToClaim * _onePeriodReward;

        _contributor.lastClaimTime = _contributor.lastClaimTime + _periodsToClaim * claimDelay;


        return uniswapQuoter.quoteExactInput(exchangePathCUSDToPACT, 1e18) * _paymentAmount / 1e18;
    }
}
