// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "./VotingToken.sol";

contract TransferrableVotingToken is VotingToken {
    /**
     * @dev Sets the values for `name`, `symbol`, and `decimals`. All three of
     * these values are immutable: they can only be set once during
     * construction.
     * @param initialSupply_ Initial supply of tokens
     * @param account_ The initial account to grant all the tokens
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint96 initialSupply_,
        address account_
    ) VotingToken(name_, symbol_, decimals_) {
        _mintVotes(account_, initialSupply_);
    }

    ////////////////////////////////
    //
    // The below code is copied from Uniswap's Uni.sol.
    // Changes are marked with "XXX".
    //
    ////////////////////////////////

    // XXX: deleted name, symbol, decimals, totalSupply, minter, mintingAllowedAfter,
    // minimumTimeBetweenMints, mintCap

    // Allowance amounts on behalf of others
    mapping (address => mapping (address => uint96)) internal allowances;

    // XXX: balances, delegates, Checkpoint, checkpoints,
    // numCheckpoints, DOMAIN_TYPEHASH, DELEGATION_TYPEHASH
    // are inherited from VotingPower.sol

    /// @notice The EIP-712 typehash for the permit struct used by the contract
    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    // XXX: nonces is inherited from VotingPower.sol

    // XXX: deleted MinterChanged

    // XXX: deleted DelegateChanged, DelegateVotesChanged, Transfer and moved them to IVotingPower

    /// @notice The standard EIP-20 approval event
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    // XXX: deleted constructor, setMinter, mint

    /**
     * @notice Get the number of tokens `spender` is approved to spend on behalf of `account`
     * @param account The address of the account holding the funds
     * @param spender The address of the account spending the funds
     * @return The number of tokens approved
     */
    function allowance(address account, address spender) external view returns (uint) {
        return allowances[account][spender];
    }

    // XXX_ADDED: upgrade to Solidity 0.8.3, which doesn't allow use of uintn(-1)
    uint256 internal constant MAX_INT = 2**256 - 1;
    uint96 internal constant MAX_INT_96 = 2**96 - 1;

    /**
     * @notice Approve `spender` to transfer up to `amount` from `src`
     * @dev This will overwrite the approval amount for `spender`
     *  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
     * @param spender The address of the account which may transfer tokens
     * @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
     * @return Whether or not the approval succeeded
     */
    function approve(address spender, uint rawAmount) external returns (bool) {
        uint96 amount;
        // XXX: uint256(-1) => MAX_INT
        if (rawAmount == MAX_INT) {
            // XXX: uint96(-1) => MAX_INT_96
            amount = MAX_INT_96;
        } else {
            amount = safe96(rawAmount, "Uni::approve: amount exceeds 96 bits");
        }

        allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Triggers an approval from owner to spends
     * @param owner The address to approve from
     * @param spender The address to be approved
     * @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
     * @param deadline The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function permit(address owner, address spender, uint rawAmount, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
        uint96 amount;
        // XXX: uint256(-1) => MAX_INT
        if (rawAmount == MAX_INT) {
            // XXX: uint96(-1) => MAX_INT_oy
            amount = MAX_INT_96;
        } else {
            amount = safe96(rawAmount, "Uni::permit: amount exceeds 96 bits");
        }

        // XXX_CHANGED: name => name()
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name())), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, rawAmount, nonces[owner]++, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "Uni::permit: invalid signature");
        require(signatory == owner, "Uni::permit: unauthorized");
        // XXX: added linter disable
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= deadline, "Uni::permit: signature expired");

        allowances[owner][spender] = amount;

        emit Approval(owner, spender, amount);
    }

    // XXX: deleted balanceOf

    /**
     * @notice Transfer `amount` tokens from `msg.sender` to `dst`
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transfer(address dst, uint rawAmount) external returns (bool) {
        // XXX_ADDED
        require(
            dst != address(this),
            "TransferrableVotingToken::transfer: cannot send tokens to contract"
        );
        uint96 amount = safe96(rawAmount, "Uni::transfer: amount exceeds 96 bits");
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /**
     * @notice Transfer `amount` tokens from `src` to `dst`
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferFrom(address src, address dst, uint rawAmount) external returns (bool) {
        // XXX_ADDED
        require(
            dst != address(this),
            "TransferrableVotingToken::transferFrom: cannot send tokens to contract"
        );
        address spender = msg.sender;
        uint96 spenderAllowance = allowances[src][spender];
        uint96 amount = safe96(rawAmount, "Uni::approve: amount exceeds 96 bits");

        // XXX: uint96(-1) => MAX_INT_96
        if (spender != src && spenderAllowance != MAX_INT_96) {
            uint96 newAllowance = sub96(spenderAllowance, amount, "Uni::transferFrom: transfer amount exceeds spender allowance");
            allowances[src][spender] = newAllowance;

            emit Approval(src, spender, newAllowance);
        }

        _transferTokens(src, dst, amount);
        return true;
    }

    // XXX: rest is in VotingPower.sol
}
