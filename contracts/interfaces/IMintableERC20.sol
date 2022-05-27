//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

interface IMintableERC20 {
    function mint(address _account, uint96 _amount) external;

    function burn(address _account, uint96 _amount) external;

    function totalSupply() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    function transfer(address _recipient, uint256 _amount) external returns (bool);

    function allowance(address _owner, address _spender) external view returns (uint256);

    function approve(address _spender, uint256 _amount) external returns (bool);

    function transferFrom(
        address _sender,
        address _recipient,
        uint256 _amount
    ) external returns (bool);
}
