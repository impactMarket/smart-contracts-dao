// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../externalInterfaces/socialConnect/ISocialConnect.sol";

interface IReferralLink {
    enum CampaignState {
        Invalid,
        Valid,
        Paused,
        Canceled
    }

    struct Campaign {
        IERC20 token;
        uint256 balance;
        CampaignState state;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardAmount;
        uint256 maxReferralLinks;
        mapping(address => uint256) referralLinks;
    }

    function getVersion() external pure returns (uint256);
    function signerWalletAddress() external view returns(address);
    function socialConnect() external view returns(ISocialConnect);
    function socialConnectIssuer() external view returns(address);
    function campaignsLength() external view returns (uint256);
    function campaigns(uint256 _campaignId) external view returns (
        IERC20 token,
        uint256 balance,
        CampaignState state,
        uint256 startTime,
        uint256 endTime,
        uint256 rewardAmount,
        uint256 maxReferralLinks
    );
    function campaignReferralLinks(uint256 _campaignId, address _senderAddress) external view returns (uint256);
    function verifiedUsersAt(uint256 index) external view returns (address);
    function verifiedUsersLength() external view returns (uint256);
    function updateSignerWalletAddress(address newSignerAddress) external;
    function addCampaign(IERC20 token, uint256 startTime, uint256 endTime, uint256 rewardAmount, uint256 maxReferralLinks) external;
    function fundCampaign(uint256 campaignId, uint256 amount) external;
    function pauseCampaign(uint256 campaignId) external;
    function unpauseCampaign(uint256 campaignId) external;
    function cancelCampaign(uint256 campaignId, address fundRecipient) external;
    function claimReward(
        address beneficiary,
        uint256[] calldata campaignIds,
        address[] calldata newUserAddresses,
        bytes[] calldata signatures
    ) external;
}
