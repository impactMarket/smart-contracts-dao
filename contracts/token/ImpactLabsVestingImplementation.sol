//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.5;

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
     * !!! before calling this method, you must ensure that there is enough IPCTs on the contract address
     *
     * @param impactLabs_           Address of the ImpactLabs
     * @param IPCT_                 Address of the IPCT token
     * @param advancePayment_       The amount of IPCT that will be given in advance to ImpactLabs
     */
    function initialize(
        address impactLabs_,
        IERC20 IPCT_,
        IDonationMiner donationMiner_,
        uint256 advancePayment_
    ) public initializer {
        require(
            address(impactLabs_) != address(0),
            "ImpactLabsVesting::initialize: impactLabs_ address not set"
        );
        require(
            address(IPCT_) != address(0),
            "ImpactLabsVesting::initialize: IPCT address not set"
        );
        require(
            address(donationMiner_) != address(0),
            "ImpactLabsVesting::initialize: donationMiner_ address not set"
        );

        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        impactLabs = impactLabs_;
        IPCT = IPCT_;
        donationMiner = donationMiner_;
        advancePayment = advancePayment_;

        transferToImpactLabs(advancePayment_);
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Transfers IPCT to ImpactLabs
     * it will not be transferred IPCTs to ImpactLabs until
     * the entire amount payed in advance will be covered
     */
    function claim() external override whenNotPaused nonReentrant {
        uint256 index = lastClaimedRewardPeriod + 1;
        uint256 rewardPeriodCount = donationMiner.rewardPeriodCount();

        uint256 rewardPerBlock;
        uint256 rewardAmount;
        uint256 startBlock;
        uint256 endBlock;
        uint256 claimAmount;

        while (index <= rewardPeriodCount) {
            (rewardPerBlock, , startBlock, endBlock, ) = donationMiner.rewardPeriods(index);
            claimAmount += ((endBlock - startBlock) * rewardPerBlock * 3) / 4;

            index++;
        }

        // if advancePayment is zero it means that all the entire amount payed in advance has been covered
        if (advancePayment == 0) {
            transferToImpactLabs(claimAmount);
        } else if (advancePayment >= claimAmount) {
            // if the claim amount is lesser than the amount of IPCTs that is still given in advance
            // it decrease advancePayment value
            // it doesn't transfer IPCTs to ImpactLabs
            advancePayment -= claimAmount;
            emit AdvancePaymentDecreased(claimAmount, advancePayment);
        } else {
            // if the claim amount is greater than the amount of IPCTs that is still given in advance
            // it decrease advancePayment to 0
            // it transfer the difference to ImpactLabs
            uint256 toTransfer = claimAmount - advancePayment;
            advancePayment = 0;

            emit AdvancePaymentDecreased(claimAmount - toTransfer, 0);
            transferToImpactLabs(toTransfer);
        }

        lastClaimedRewardPeriod = rewardPeriodCount;
    }

    /**
     * @notice Transfers an amount of an ERC20 from this contract to an address
     *
     * @param token_ address of the ERC20 token
     * @param to_ address of the receiver
     * @param amount_ amount of the transaction
     */
    function transfer(
        IERC20 token_,
        address to_,
        uint256 amount_
    ) external override onlyOwner nonReentrant {
        token_.safeTransfer(to_, amount_);

        emit TransferERC20(address(token_), to_, amount_);
    }

    function transferToImpactLabs(uint256 amount) internal nonReentrant {
        if (amount > 0) {
            require(
                IPCT.balanceOf(address(this)) >= amount,
                "ImpactLabsVesting::transferToImpactLabs: ERR_REWARD_TOKEN_BALANCE"
            );
            IPCT.safeTransfer(impactLabs, amount);
        }

        emit Claimed(amount);
    }
}
