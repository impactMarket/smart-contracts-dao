//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/DonationMinerStorageV2.sol";

contract DonationMinerImplementationV2 is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    DonationMinerStorageV2
{
    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a donation has been added
     *
     * @param donationId  Id of the donation
     * @param donor       Address of the donner
     * @param amount      Value of the donation
     * @param target      Address of the receiver (community or treasury)
     *                    or address of the DonationMiner contract otherwise
     */
    event DonationAdded(
        uint256 indexed donationId,
        address indexed donor,
        uint256 amount,
        address indexed target
    );

    /**
     * @notice Triggered when a donor has claimed his reward
     *
     * @param donor       Address of the donner
     * @param amount      Value of the reward
     */
    event RewardClaimed(address indexed donor, uint256 amount);

    /**
     * @notice Triggered when an amount of an ERC20 has been transferred from this contract to an address
     *
     * @param token               ERC20 token address
     * @param to                  Address of the receiver
     * @param amount              Amount of the transaction
     */
    event TransferERC20(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Triggered when reward period params have been updated
     *
     * @param oldRewardPeriodSize   Old rewardPeriodSize value
     * @param oldDecayNumerator     Old decayNumerator value
     * @param oldDecayDenominator   Old decayDenominator value
     * @param newRewardPeriodSize   New rewardPeriodSize value
     * @param newDecayNumerator     New decayNumerator value
     * @param newDecayDenominator   New decayDenominator value
     *
     * For further information regarding each parameter, see
     * *DonationMiner* smart contract initialize method.
     */
    event RewardPeriodParamsUpdated(
        uint256 oldRewardPeriodSize,
        uint256 oldDecayNumerator,
        uint256 oldDecayDenominator,
        uint256 newRewardPeriodSize,
        uint256 newDecayNumerator,
        uint256 newDecayDenominator
    );

    /**
     * @notice Triggered when the claimDelay address has been updated
     *
     * @param oldClaimDelay            Old claimDelay value
     * @param newClaimDelay            New claimDelay value
     */
    event ClaimDelayUpdated(uint256 oldClaimDelay, uint256 newClaimDelay);

    /**
     * @notice Triggered when the treasury address has been updated
     *
     * @param oldTreasury             Old treasury address
     * @param newTreasury             New treasury address
     */
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Enforces beginning rewardPeriod has started
     */
    modifier whenStarted() {
        require(block.number >= rewardPeriods[1].startBlock, "DonationMiner: ERR_NOT_STARTED");
        _;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 2;
    }

    /**
     * @notice Returns the amount of cUSD donated by a user in a reward period
     *
     * @param _period number of the reward period
     * @param _donor address of the donor
     * @return uint256 amount of cUSD donated by the user in this reward period
     */
    function rewardPeriodDonorAmount(uint256 _period, address _donor)
        external
        view
        override
        returns (uint256)
    {
        return rewardPeriods[_period].donorAmounts[_donor];
    }

    /**
     * @notice Returns a reward period number from a donor reward period list
     *
     * @param _donor address of the donor
     * @param _rewardPeriodIndex index of the reward period
     * @return uint256 number of the reward period
     */
    function donorRewardPeriod(address _donor, uint256 _rewardPeriodIndex)
        external
        view
        override
        returns (uint256)
    {
        return donors[_donor].rewardPeriods[_rewardPeriodIndex];
    }

    /**
     * @notice Updates reward period default params
     *
     * @param _newRewardPeriodSize value of new rewardPeriodSize
     * @param _newDecayNumerator value of new decayNumerator
     * @param _newDecayDenominator value of new decayDenominator
     */
    function updateRewardPeriodParams(
        uint256 _newRewardPeriodSize,
        uint256 _newDecayNumerator,
        uint256 _newDecayDenominator
    ) external override onlyOwner {
        uint256 _oldRewardPeriodSize = rewardPeriodSize;
        uint256 _oldDecayNumerator = decayNumerator;
        uint256 _oldDecayDenominator = decayDenominator;

        rewardPeriodSize = _newRewardPeriodSize;
        decayNumerator = _newDecayNumerator;
        decayDenominator = _newDecayDenominator;

        emit RewardPeriodParamsUpdated(
            _oldRewardPeriodSize,
            _oldDecayNumerator,
            _oldDecayDenominator,
            _newRewardPeriodSize,
            _newDecayNumerator,
            _newDecayDenominator
        );
    }

    /**
     * @notice Updates claimDelay value
     *
     * @param _newClaimDelay      Number of reward periods a donor has to wait after
     *                            a donation until he will be able to claim his reward
     */
    function updateClaimDelay(uint256 _newClaimDelay) external override onlyOwner {
        uint256 _oldClaimDelay = claimDelay;
        claimDelay = _newClaimDelay;

        emit ClaimDelayUpdated(_oldClaimDelay, _newClaimDelay);
    }

    /**
     * @notice Updates Treasury address
     *
     * @param _newTreasury address of new treasury_ contract
     */
    function updateTreasury(ITreasury _newTreasury) external override onlyOwner {
        address _oldTreasuryAddress = address(treasury);
        treasury = _newTreasury;

        emit TreasuryUpdated(_oldTreasuryAddress, address(_newTreasury));
    }

    /**
     * @notice Transfers cUSD tokens to the treasury contract
     *
     * @param _amount Amount of cUSD tokens to deposit.
     */
    function donate(uint256 _amount) external override whenNotPaused whenStarted nonReentrant {
        // Transfer the cUSD from the donor to the treasury
        cUSD.safeTransferFrom(msg.sender, address(treasury), _amount);

        addDonation(msg.sender, _amount, address(treasury));
    }

    /**
     * @dev Transfers cUSD tokens to the community contract
     *
     * @param _community address of the community
     * @param _amount amount of cUSD tokens to deposit
     */
    function donateToCommunity(ICommunity _community, uint256 _amount)
        external
        override
        whenNotPaused
        whenStarted
        nonReentrant
    {
        ICommunityAdmin _communityAdmin = treasury.communityAdmin();
        require(
            _communityAdmin.communities(address(_community)) ==
                ICommunityAdmin.CommunityState.Valid,
            "DonationMiner::donateToCommunity: This is not a valid community address"
        );
        // Transfer the cUSD from the donor to the community
        _community.donate(msg.sender, _amount);
        addDonation(msg.sender, _amount, address(_community));
    }

    /**
     * @notice Transfers to the sender the rewards
     */
    function claimRewards() external override whenNotPaused whenStarted nonReentrant {
        initializeRewardPeriods();

        Donor storage _donor = donors[msg.sender];
        uint256 _claimAmount;

        uint256 lastPeriodToClaim;

        if (rewardPeriodCount > claimDelay) {
            lastPeriodToClaim = rewardPeriodCount - claimDelay;
        }

        (_claimAmount, _donor.lastClaim) = _calculateRewardAndIndexByPeriodNumber(
            msg.sender,
            lastPeriodToClaim
        );

        if (_claimAmount == 0) {
            return;
        }

        if (_claimAmount > PACT.balanceOf(address(this))) {
            _claimAmount = PACT.balanceOf(address(this));
        }

        PACT.safeTransfer(msg.sender, _claimAmount);

        emit RewardClaimed(msg.sender, _claimAmount);
    }

    /**
     * @notice Calculates the rewards from ended reward periods of a donor
     *
     * @param _donorAddress address of the donor
     * @param _lastPeriodNumber last reward period number to be computed
     * @return uint256 sum of all donor's rewards that has not been claimed until _lastPeriodNumber
     */
    function calculateClaimableRewardsByPeriodNumber(
        address _donorAddress,
        uint256 _lastPeriodNumber
    ) public view override returns (uint256) {
        uint256 _claimAmount;
        (_claimAmount, ) = _calculateRewardAndIndexByPeriodNumber(_donorAddress, _lastPeriodNumber);

        return _claimAmount;
    }

    /**
     * @notice Calculates the rewards from ended reward periods of a donor
     *
     * @param _donorAddress address of the donor
     * @return uint256 sum of all donor's rewards that has not been claimed
     */
    function calculateClaimableRewards(address _donorAddress)
        public
        view
        override
        returns (uint256)
    {
        uint256 _claimAmount;
        (_claimAmount, ) = _calculateRewardAndIndexByPeriodNumber(_donorAddress, rewardPeriodCount);

        return _claimAmount;
    }

    /**
     * @notice Calculates the estimate reward of a donor for current reward period
     *
     * @param _donorAddress address of the donor
     * @return uint256 reward that donor will receive in current reward period if there isn't another donation
     */
    function estimateClaimableReward(address _donorAddress)
        external
        view
        override
        whenStarted
        whenNotPaused
        returns (uint256)
    {
        RewardPeriod storage _lastRewardPeriod = rewardPeriods[rewardPeriodCount];

        uint256 _claimAmount;

        if (isCurrentRewardPeriodInitialized()) {
            _claimAmount +=
                (_lastRewardPeriod.rewardAmount * _lastRewardPeriod.donorAmounts[_donorAddress]) /
                _lastRewardPeriod.donationsAmount;
        }

        return _claimAmount;
    }

    /**
     * @notice Calculates the number of PACTs given for each block in current reward period
     *
     * @return uint256 current reward per block
     */
    function calculateRewardPerBlock() internal view returns (uint256) {
        return
            (rewardPeriods[rewardPeriodCount - 1].rewardPerBlock * decayNumerator) /
            decayDenominator;
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
     * @notice Initializes all reward periods that haven't been initialized yet until the current one.
     *         The first donor in a reward period will pay for that operation.
     */
    function initializeRewardPeriods() internal {
        RewardPeriod storage _lastPeriod = rewardPeriods[rewardPeriodCount];

        while (_lastPeriod.endBlock < block.number) {
            rewardPeriodCount++;
            RewardPeriod storage _newPeriod = rewardPeriods[rewardPeriodCount];
            _newPeriod.startBlock = _lastPeriod.endBlock + 1;
            _newPeriod.endBlock = _newPeriod.startBlock + rewardPeriodSize - 1;
            _newPeriod.rewardPerBlock = calculateRewardPerBlock();
            uint256 _rewardAmount = rewardPeriodSize * _newPeriod.rewardPerBlock;
            if (_lastPeriod.donationsAmount == 0) {
                _rewardAmount += _lastPeriod.rewardAmount;
            }
            _newPeriod.rewardAmount = _rewardAmount;
            _lastPeriod = _newPeriod;
        }
    }

    /**
     * @notice Adds a new donation in donations list
     *
     * @param _donorAddress address of the donner
     * @param _amount amount of the donation
     * @param _target address of the receiver (community or treasury)
     */
    function addDonation(
        address _donorAddress,
        uint256 _amount,
        address _target
    ) internal {
        initializeRewardPeriods();

        donationCount++;
        Donation storage _donation = donations[donationCount];
        _donation.donor = _donorAddress;
        _donation.target = _target;
        _donation.amount = _amount;
        _donation.blockNumber = block.number;
        _donation.rewardPeriod = rewardPeriodCount;
        _donation.token = cUSD;
        _donation.tokenPrice = 1e18;

        updateRewardPeriodAmounts(rewardPeriodCount, msg.sender, _amount);
        addCurrentRewardPeriodToDonor(msg.sender);

        emit DonationAdded(donationCount, msg.sender, _amount, _target);
    }

    /**
     * @notice Adds the current reward period number to a donor's list only if it hasn't been added yet
     *
     * @param _donorAddress address of the donor
     */
    function addCurrentRewardPeriodToDonor(address _donorAddress) internal {
        Donor storage _donor = donors[_donorAddress];
        uint256 _lastDonorRewardPeriod = _donor.rewardPeriods[_donor.rewardPeriodsCount];

        //ensures that the current reward period number hasn't been added in the donor's list
        if (_lastDonorRewardPeriod != rewardPeriodCount) {
            _donor.rewardPeriodsCount++;
            _donor.rewardPeriods[_donor.rewardPeriodsCount] = rewardPeriodCount;
        }
    }

    /**
     * @notice Updates the amounts of a reward period
     *
     * @param _rewardPeriodNumber number of the reward period
     * @param _donorAddress address of the donor
     * @param _amount amount to be added
     */
    function updateRewardPeriodAmounts(
        uint256 _rewardPeriodNumber,
        address _donorAddress,
        uint256 _amount
    ) internal {
        RewardPeriod storage _currentPeriod = rewardPeriods[_rewardPeriodNumber];
        _currentPeriod.donationsAmount += _amount;
        _currentPeriod.donorAmounts[_donorAddress] += _amount;
    }

    /**
     * @notice Checks if current reward period has been initialized
     *
     * @return bool true if current reward period has been initialized
     */
    function isCurrentRewardPeriodInitialized() internal view returns (bool) {
        return rewardPeriods[rewardPeriodCount].endBlock >= block.number;
    }

    /**
     * @notice Initializes the first reward period
     *
     * @param _startingBlock first block
     * @param _firstRewardPerBlock initial reward per block
     */
    function initFirstPeriod(uint256 _startingBlock, uint256 _firstRewardPerBlock) internal {
        RewardPeriod storage _firstPeriod = rewardPeriods[1];
        _firstPeriod.startBlock = _startingBlock;
        _firstPeriod.endBlock = _startingBlock + rewardPeriodSize - 1;
        _firstPeriod.rewardPerBlock = _firstRewardPerBlock;
        _firstPeriod.rewardAmount = _firstRewardPerBlock * rewardPeriodSize;
    }

    /**
     * @notice Calculates the reward for a donor starting with his last reward period claimed
     *
     * @param _donorAddress address of the donor
     * @param _lastPeriodNumber last reward period number to be computed
     * @return uint256 sum of all donor's rewards that has not been claimed until _lastPeriodNumber
     * @return uint256 index of the last rewardPeriod that has been computed
     */
    function _calculateRewardAndIndexByPeriodNumber(
        address _donorAddress,
        uint256 _lastPeriodNumber
    ) internal view returns (uint256, uint256) {
        Donor storage _donor = donors[_donorAddress];
        uint256 _claimAmount;
        uint256 _rewardPeriodNumber;
        uint256 _index = _donor.lastClaim + 1;

        while (_index <= _donor.rewardPeriodsCount) {
            _rewardPeriodNumber = _donor.rewardPeriods[_index];
            RewardPeriod storage _rewardPeriod = rewardPeriods[_rewardPeriodNumber];

            if (_rewardPeriodNumber > _lastPeriodNumber || _rewardPeriod.endBlock > block.number) {
                break;
            }

            _claimAmount +=
                (_rewardPeriod.rewardAmount * _rewardPeriod.donorAmounts[_donorAddress]) /
                _rewardPeriod.donationsAmount;
            _index++;
        }

        return (_claimAmount, _index - 1);
    }
}
