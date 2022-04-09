// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface ICommunityLegacy {
    function cooldown(address _account) external returns(uint256);
    function lastInterval(address _account) external returns(uint256);
    function claimed(address _account) external returns(uint256);
    function beneficiaries(address _account) external returns(uint256);
    function claimAmount() external returns(uint256);
    function baseInterval() external returns(uint256);
    function incrementInterval() external returns(uint256);
    function maxClaim() external returns(uint256);
    function previousCommunityContract() external returns(address);
    function impactMarketAddress() external returns(address);
    function cUSDAddress() external returns(address);
    function locked() external returns(bool);
    function addManager(address _account) external;
    function removeManager(address _account) external;
    function addBeneficiary(address _account) external;
    function lockBeneficiary(address _account) external;
    function unlockBeneficiary(address _account) external;
    function removeBeneficiary(address _account) external;
    function claim() external;
    function edit(uint256 _claimAmount, uint256 _maxClaim, uint256 _baseInterval, uint256 _incrementInterval) external;
    function lock() external;
    function unlock() external;
    function migrateFunds(address _newCommunity, address _newCommunityManager) external;
    function hasRole(bytes32 role, address account) external view returns(bool);
}
