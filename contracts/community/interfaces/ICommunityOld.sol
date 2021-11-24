// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface ICommunityOld {
    function cooldown(address account) external returns(uint256);
    function lastInterval(address account) external returns(uint256);
    function claimed(address account) external returns(uint256);
    function beneficiaries(address account) external returns(uint256);
    function claimAmount() external returns(uint256);
    function baseInterval() external returns(uint256);
    function incrementInterval() external returns(uint256);
    function maxClaim() external returns(uint256);
    function previousCommunityContract() external returns(address);
    function impactMarketAddress() external returns(address);
    function cUSDAddress() external returns(address);
    function locked() external returns(bool);
    function addManager(address account) external;
    function removeManager(address account) external;
    function addBeneficiary(address account) external;
    function lockBeneficiary(address account) external;
    function unlockBeneficiary(address account) external;
    function removeBeneficiary(address account) external;
    function claim() external;
    function edit(uint256 claimAmount, uint256 maxClaim, uint256 baseInterval, uint256 incrementInterval) external;
    function lock() external;
    function unlock() external;
    function migrateFunds(address newCommunity, address newCommunityManager) external;
}
