//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ImpactLabsVestingStorageV1.sol";

contract ImpactLabsVestingImplementation is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ImpactLabsVestingStorageV1
{
    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when ImpactLabs has claimed
     *
     * @param amount      Value of the claim
     */
    event Claimed(uint256 amount);

    /**
     * @notice Triggered when advancePayment has been decreased
     *
     * @param amount                  Value of the decrease
     * @param advancePaymentLeft      Value of the advancePayment left
     */
    event AdvancePaymentDecreased(uint256 amount, uint256 advancePaymentLeft);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Used to initialize a new ImpactLabsVesting contract
     * !!! before calling this method, you must ensure that there is enough PACTs on the contract address
     *
     * @param _impactLabs           Address of the ImpactLabs
     * @param _PACT                 Address of the PACT Token
     * @param _advancePayment       The amount of PACT that will be given in advance to ImpactLabs
     */
    function initialize(
        address _impactLabs,
        IERC20 _PACT,
        IDonationMiner _donationMiner,
        uint256 _advancePayment
    ) public initializer {
        require(
            address(_impactLabs) != address(0),
            "ImpactLabsVesting::initialize: impactLabs_ address not set"
        );
        require(
            address(_PACT) != address(0),
            "ImpactLabsVesting::initialize: PACT address not set"
        );
        require(
            address(_donationMiner) != address(0),
            "ImpactLabsVesting::initialize: donationMiner_ address not set"
        );

        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        impactLabs = _impactLabs;
        PACT = _PACT;
        donationMiner = _donationMiner;
        advancePayment = _advancePayment;
        nextRewardPeriod = 1;

        transferToImpactLabs(_advancePayment);
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Transfers PACT to ImpactLabs
     * it will not be transferred PACTs to ImpactLabs until
     * the entire amount payed in advance will be covered
     */
    function claim() external override whenNotPaused {
        uint256 _index = nextRewardPeriod;
        uint256 _rewardPeriodCount = donationMiner.rewardPeriodCount();

        uint256 _rewardPerBlock;
        uint256 _startBlock;
        uint256 _endBlock;
        uint256 _claimAmount;

        while (_index <= _rewardPeriodCount) {
            (_rewardPerBlock, , _startBlock, _endBlock, ) = donationMiner.rewardPeriods(_index);

            if (_endBlock >= block.number) {
                break;
            }

            _claimAmount += ((_endBlock - _startBlock + 1) * _rewardPerBlock * 3) / 4;
            _index++;
        }

        // if advancePayment is zero it means that all the entire amount payed in advance has been covered
        if (advancePayment == 0) {
            transferToImpactLabs(_claimAmount);
        } else if (advancePayment >= _claimAmount) {
            // if the claim amount is lesser than the amount of PACTs that is still given in advance
            // it decrease advancePayment value
            // it doesn't transfer PACTs to ImpactLabs
            advancePayment -= _claimAmount;
            emit AdvancePaymentDecreased(_claimAmount, advancePayment);
        } else {
            // if the claim amount is greater than the amount of PACTs that is still given in advance
            // it decrease advancePayment to 0
            // it transfer the difference to ImpactLabs
            uint256 toTransfer = _claimAmount - advancePayment;
            advancePayment = 0;

            emit AdvancePaymentDecreased(_claimAmount - toTransfer, 0);
            transferToImpactLabs(toTransfer);
        }

        nextRewardPeriod = _index;
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
     * @notice Transfers an amount of PACTs from this contract to impactLabs address
     *
     * @param _amount amount of the transaction
     */
    function transferToImpactLabs(uint256 _amount) internal nonReentrant {
        if (_amount > 0) {
            require(
                PACT.balanceOf(address(this)) >= _amount,
                "ImpactLabsVesting::transferToImpactLabs: ERR_REWARD_TOKEN_BALANCE"
            );
            PACT.safeTransfer(impactLabs, _amount);
        }

        emit Claimed(_amount);
    }
}
