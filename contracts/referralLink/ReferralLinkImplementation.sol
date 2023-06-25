// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/ReferralLinkStorageV1.sol";

contract ReferralLinkImplementation is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ReferralLinkStorageV1
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20Upgradeable for IERC20;
    using ECDSA for bytes32;

    /**
     * @notice Triggered when a campaign state has been changed
     *
     * @param campaignId        Id of the campaign
     * @param startTime         Start date of the campaign
     * @param endTime           End date of the campaign
     * @param rewardAmount      Reward amount of the campaign
     * @param maxReferralLinks  Maximum number of referral links for an user
     */
    event CampaignAdded(
        uint256 indexed campaignId,
        uint256 startTime,
        uint256 endTime,
        uint256 rewardAmount,
        uint256 maxReferralLinks
    );

    /**
     * @notice Triggered when a campaign has been funded
     *
     * @param campaignId        Id of the campaign
     * @param sender            Address of the sender
     * @param amount            Amount of the fund
     */
    event CampaignFunded(uint256 indexed campaignId, address indexed sender, uint256 amount);

    /**
     * @notice Triggered when a campaign state has been changed
     *
     * @param campaignId           Id of the campaign
     * @param state             New state of the campaign
     */
    event CampaignStateChanged(uint256 indexed campaignId, CampaignState indexed state);

    /**
     * @notice Triggered when a reward has been claimed
     *
     * @param sender           address of the sender to be rewarded
     * @param campaignId       the id of the campaign
     * @param receiverAddress  address of the receiver
     */
    event RewardClaimed(
        address indexed sender,
        uint256 indexed campaignId,
        address receiverAddress
    );

    /**
     * @notice Used to initialize a new contract
     *
     * @param _signerWalletAddress    Address of the backend wallet
     */
    function initialize(
        address _signerWalletAddress,
        address _socialConnectAddress,
        address _socialConnectIssuer
    ) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init_unchained();

        signerWalletAddress = _signerWalletAddress;
        socialConnect = ISocialConnect(_socialConnectAddress);
        socialConnectIssuer = _socialConnectIssuer;
    }

    /**
     * @notice Returns the current implementation version
     */
    function getVersion() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the details of a campaign
     *
     * @param _campaignId id of the campaign
     * @return token address of the token
     * @return balance balance of the campaign
     * @return state state of the campaign
     * @return startTime start date of the campaign
     * @return endTime end date of the campaign
     * @return rewardAmount reward amount of the campaign
     * @return maxReferralLinks maximum number of referral links
     */
    function campaigns(uint256 _campaignId)
        external
        view
        override
        returns (
            IERC20 token,
            uint256 balance,
            CampaignState state,
            uint256 startTime,
            uint256 endTime,
            uint256 rewardAmount,
            uint256 maxReferralLinks
        )
    {
        Campaign storage _campaign = _campaigns[_campaignId];
        return (
            _campaign.token,
            _campaign.balance,
            _campaign.state,
            _campaign.startTime,
            _campaign.endTime,
            _campaign.rewardAmount,
            _campaign.maxReferralLinks
        );
    }

    /**
     * @notice Returns the number of referral links used by a sender
     *
     * @param _campaignId id of the campaign
     * @param _senderAddress address of the token
     * @return the number of referral links used by a sender
     */
    function campaignReferralLinks(uint256 _campaignId, address _senderAddress)
        external
        view
        override
        returns (uint256)
    {
        return _campaigns[_campaignId].referralLinks[_senderAddress];
    }

    /**
     * @notice Returns the address of an verified user at a given index
     *
     * @param index index of the verified user
     * @return the address of an verified user at a given index
     */
    function verifiedUsersAt(uint256 index) external view override returns (address) {
        return _verifiedUsers.at(index);
    }

    /**
     * @notice Returns the number of verified users
     *
     * @return the number of verified users
     */
    function verifiedUsersLength() external view override returns (uint256) {
        return _verifiedUsers.length();
    }

    /**
     * @dev Pauses the contract
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /** Updates the address of the backend wallet
     *
     * @param _newSignerWalletAddress address of the new backend wallet
     */
    function updateSignerWalletAddress(address _newSignerWalletAddress)
        external
        override
        onlyOwner
    {
        signerWalletAddress = _newSignerWalletAddress;
    }

    /**
     * @notice Adds a new campaign
     *
     * @param _token      the token used for reward
     * @param _startTime  the start date of the campaign
     * @param _endTime    the end date of the campaign
     * @param _rewardAmount the reward amount of the campaign
     */
    function addCampaign(
        IERC20 _token,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _rewardAmount,
        uint256 _maxReferralLinks
    ) external override onlyOwner {
        require(_startTime < _endTime && _endTime > block.timestamp, "ReferralLink: Invalid dates");

        _campaigns[campaignsLength].state = CampaignState.Valid;
        _campaigns[campaignsLength].token = _token;
        _campaigns[campaignsLength].startTime = _startTime;
        _campaigns[campaignsLength].endTime = _endTime;
        _campaigns[campaignsLength].rewardAmount = _rewardAmount;
        _campaigns[campaignsLength].maxReferralLinks = _maxReferralLinks;

        emit CampaignAdded(campaignsLength, _startTime, _endTime, _rewardAmount, _maxReferralLinks);

        campaignsLength++;
    }

    /**
     * @notice Pauses a campaign
     *
     * @param _campaignId id of the campaign
     */
    function pauseCampaign(uint256 _campaignId) external override onlyOwner {
        Campaign storage _campaign = _campaigns[_campaignId];

        require(_campaign.state == CampaignState.Valid, "ReferralLink: Invalid campaign id");

        _campaign.state = CampaignState.Paused;

        emit CampaignStateChanged(_campaignId, CampaignState.Paused);
    }

    /**
     * @notice Unpauses a campaign
     *
     * @param _campaignId id of the campaign
     */
    function unpauseCampaign(uint256 _campaignId) external override onlyOwner {
        Campaign storage _campaign = _campaigns[_campaignId];

        require(_campaign.state == CampaignState.Paused, "ReferralLink: Invalid campaign id");

        _campaign.state = CampaignState.Valid;

        emit CampaignStateChanged(_campaignId, CampaignState.Valid);
    }

    /**
     * @notice Cancels a campaign
     *
     * @param _campaignId id of the campaign
     * @param _fundRecipient the address of the recipient who will receive the funds allocated for this campaign
     */
    function cancelCampaign(uint256 _campaignId, address _fundRecipient)
        external
        override
        onlyOwner
    {
        Campaign storage _campaign = _campaigns[_campaignId];

        require(
            _campaign.state == CampaignState.Valid || _campaign.state == CampaignState.Paused,
            "ReferralLink: Invalid campaign id"
        );

        _campaign.state = CampaignState.Canceled;
        uint256 _campaignBalance = _campaign.balance;
        _campaign.balance = 0;

        _campaign.token.safeTransfer(_fundRecipient, _campaignBalance);

        emit CampaignStateChanged(_campaignId, CampaignState.Canceled);
    }

    /**
     * @notice Funds a campaign
     *
     * @param _campaignId   the id of the campaign
     * @param _amount the amount to be funded
     */
    function fundCampaign(uint256 _campaignId, uint256 _amount) external override {
        Campaign storage _campaign = _campaigns[_campaignId];

        require(
            _campaign.state == CampaignState.Valid || _campaign.state == CampaignState.Paused,
            "ReferralLink: Invalid campaign id"
        );

        _campaign.token.safeTransferFrom(msg.sender, address(this), _amount);

        _campaign.balance += _amount;

        emit CampaignFunded(_campaignId, msg.sender, _amount);
    }

    /**
     * @notice Allows users to claim the reward for a campaign using a signature
     *
     * @param _sender address of the sender
     * @param _campaignIds ids of the campaigns
     * @param _newUserAddresses addresses of the new users
     * @param _signatures signatures from the backend
     */
    function claimReward(
        address _sender,
        uint256[] calldata _campaignIds,
        address[] calldata _newUserAddresses,
        bytes[] calldata _signatures
    ) external override {
        require(
            _campaignIds.length == _newUserAddresses.length &&
                _campaignIds.length == _signatures.length,
            "ReferralLink: Invalid data"
        );

        Campaign storage _campaign;

        uint256 _index;
        bytes32 _messageHash;

        for (_index = 0; _index < _campaignIds.length; _index++) {
            _campaign = _campaigns[_campaignIds[_index]];

            require(_campaign.state == CampaignState.Valid, "ReferralLink: Invalid campaign id");

            require(
                _campaign.startTime <= block.timestamp,
                "ReferralLink: Campaign has not started yet"
            );

            require(_campaign.endTime >= block.timestamp, "ReferralLink: Campaign has ended");

            require(
                _campaign.referralLinks[_sender] < _campaign.maxReferralLinks,
                "ReferralLink: Already reached max referral links"
            );

            require(
                !_verifiedUsers.contains(_newUserAddresses[_index]),
                "ReferralLink: This user already exists"
            );

            require(
                _campaign.balance >= _campaign.rewardAmount,
                "ReferralLink: Campaign doesn't have enough funds"
            );

            require(
                _isSocialConnectVerified(_newUserAddresses[_index]),
                "ReferralLink: User has not been verified"
            );

            _messageHash = keccak256(
                abi.encode(_sender, _campaignIds[_index], _newUserAddresses[_index])
            );

            require(
                signerWalletAddress ==
                    _messageHash.toEthSignedMessageHash().recover(_signatures[_index]),
                "ReferralLink: Invalid signature"
            );

            _campaign.referralLinks[_sender]++;
            _verifiedUsers.add(_newUserAddresses[_index]);

            _campaign.token.safeTransfer(_sender, _campaign.rewardAmount);
            _campaign.token.safeTransfer(_newUserAddresses[_index], _campaign.rewardAmount);

            _campaign.balance -= _campaign.rewardAmount * 2;

            emit RewardClaimed(_sender, _campaignIds[_index], _newUserAddresses[_index]);
        }
    }

    function _isSocialConnectVerified(address _userAddress) internal view returns (bool) {
        address[] memory _issuers = new address[](1);
        _issuers[0] = address(socialConnectIssuer);
        (uint256[] memory _countsPerIssuer, ) = socialConnect.lookupIdentifiers(
            _userAddress,
            _issuers
        );

        return _countsPerIssuer[0] > 0;
    }
}
