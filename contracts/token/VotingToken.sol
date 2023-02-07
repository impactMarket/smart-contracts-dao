// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "./interfaces/INonTransferrableToken.sol";
import "./VotingPower.sol";

/**
 * A non-transferrable token that can vote.
 */
contract VotingToken is INonTransferrableToken, VotingPower {
    string private _symbol;
    uint8 private immutable _decimals;

    /**
     * @dev Sets the values for `name`, `symbol`, and `decimals`. All three of
     * these values are immutable: they can only be set once during
     * construction.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) VotingPower(name_) {
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name()
        public
        view
        override(INonTransferrableToken, VotingPower)
        returns (string memory)
    {
        return VotingPower.name();
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return totalVotingPower();
    }

    function balanceOf(address _account) public view override returns (uint256) {
        return votingPower(_account);
    }
}
