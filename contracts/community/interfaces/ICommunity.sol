// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICommunity {
    function previousCommunity() external view returns(address);
    function claimAmount() external view returns(uint256);
    function baseInterval() external view returns(uint256);
    function incrementInterval() external view returns(uint256);
    function maxClaim() external view returns(uint256);
    function previousCommunityContract() external view returns(address);
    function hasRole(bytes32 role, address account) external view returns(bool);
    function migrateFunds(ICommunity _newCommunity, address _newCommunityManager) external;
    function validBeneficiaryCount() external view returns(uint);
    function donate(address sender, uint256 amount) external;
    function addTreasuryFunds(uint256 amount) external;
    function treasuryFunds() external view returns(uint);
    function privateFunds() external view returns(uint);
    function transferFunds(IERC20 token, address to, uint256 amount) external;
}
