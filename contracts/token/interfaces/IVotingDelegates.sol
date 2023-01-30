// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

/**
 * Interface for a contract that keeps track of voting delegates.
 */
interface IVotingDelegates {
    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    /// @notice An event emitted when an account's voting power is transferred.
    // - If `from` is `address(0)`, power was minted.
    // - If `to` is `address(0)`, power was burned.
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /// @notice Name of the contract.
    // Required for signing.
    function name() external view returns (string memory);

    /// @notice A record of each accounts delegate
    function delegates(address delegatee) external view returns (address);

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external;

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Get the amount of voting power of an account
     * @param account The address of the account to get the balance of
     * @return The amount of voting power held
     */
    function votingPower(address account) external view returns (uint96);

    /// @notice Total voting power in existence.
    function totalVotingPower() external view returns (uint96);
}
