// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "./interfaces/IHasVotes.sol";
import "./interfaces/IVotingDelegates.sol";

/**
 * Power to vote. Heavily based on Uni.
 */
contract VotingPower is IHasVotes, IVotingDelegates {
    // Name of the token. This cannot be changed after creating the token.
    string private _name;

    // Total amount of voting power available.
    uint96 private totalVotingPowerSupply;

    constructor(string memory name_) {
        _name = name_;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @notice Mint new voting power
     * @param dst The address of the destination account
     * @param amount The amount of voting power to be minted
     */
    function _mintVotes(address dst, uint96 amount) internal {
        require(dst != address(0), "VotingPower::_mintVotes: cannot mint to the zero address");

        // transfer the amount to the recipient
        balances[dst] = add96(
            balances[dst],
            amount,
            "VotingPower::_mintVotes: mint amount overflows"
        );
        totalVotingPowerSupply = add96(
            totalVotingPowerSupply,
            amount,
            "VotingPower::_mintVotes: total supply overflows"
        );
        emit Transfer(address(0), dst, amount);

        // move delegates
        _moveDelegates(address(0), delegates[dst], amount);
    }

    /**
     * @notice Burn voting power
     * @param src The address of the source account
     * @param amount The amount of voting power to be burned
     */
    function _burnVotes(address src, uint96 amount) internal {
        require(src != address(0), "VotingPower::_burnVotes: cannot burn from the zero address");

        // transfer the amount to the recipient
        balances[src] = sub96(
            balances[src],
            amount,
            "VotingPower::_burnVotes: burn amount underflows"
        );
        totalVotingPowerSupply = sub96(
            totalVotingPowerSupply,
            amount,
            "VotingPower::_burnVotes: total supply underflows"
        );
        emit Transfer(src, address(0), amount);

        // move delegates
        _moveDelegates(delegates[src], address(0), amount);
    }

    /**
     * @notice Get the amount of voting power of an account
     * @param account The address of the account to get the balance of
     * @return The amount of voting power held
     */
    function votingPower(address account) public view override returns (uint96) {
        return balances[account];
    }

    function totalVotingPower() public view override returns (uint96) {
        return totalVotingPowerSupply;
    }

    ////////////////////////////////
    //
    // The below code is copied from ../uniswap-governance/contracts/Uni.sol.
    // Changes are marked with "XXX".
    //
    ////////////////////////////////

    // XXX: deleted name, symbol, decimals, totalSupply, minter, mintingAllowedAfter,
    // minimumTimeBetweenMints, mintCap, allowances

    // Official record of token balances for each account
    // XXX: internal => private visibility
    mapping(address => uint96) private balances;

    /// @notice A record of each accounts delegate
    mapping(address => address) public override delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    // XXX: deleted PERMIT_TYPEHASH

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    // XXX: deleted MinterChanged

    // XXX: deleted DelegateChanged, DelegateVotesChanged, Transfer and moved them to IVotingPower

    // XXX: deleted Approval

    // XXX: deleted constructor, setMinter, mint, allowance, approve, permit, balanceOf

    // XXX: deleted transfer, transferFrom

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public override {
        return _delegate(msg.sender, delegatee);
    }

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
    ) public override {
        // XXX_CHANGED: name => _name
        bytes32 domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(_name)), getChainId(), address(this))
        );
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "Uni::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "Uni::delegateBySig: invalid nonce");
        // XXX: added linter disable
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp <= expiry, "Uni::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view override returns (uint96) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber)
        public
        view
        override
        returns (uint96)
    {
        require(blockNumber < block.number, "Uni::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint96 delegatorBalance = balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _transferTokens(
        address src,
        address dst,
        uint96 amount
    ) internal {
        require(src != address(0), "Uni::_transferTokens: cannot transfer from the zero address");
        require(dst != address(0), "Uni::_transferTokens: cannot transfer to the zero address");

        balances[src] = sub96(
            balances[src],
            amount,
            "Uni::_transferTokens: transfer amount exceeds balance"
        );
        balances[dst] = add96(
            balances[dst],
            amount,
            "Uni::_transferTokens: transfer amount overflows"
        );
        emit Transfer(src, dst, amount);

        _moveDelegates(delegates[src], delegates[dst], amount);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint96 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint96 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint96 srcRepNew = sub96(
                    srcRepOld,
                    amount,
                    "Uni::_moveVotes: vote amount underflows"
                );
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint96 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint96 dstRepNew = add96(
                    dstRepOld,
                    amount,
                    "Uni::_moveVotes: vote amount overflows"
                );
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint96 oldVotes,
        uint96 newVotes
    ) internal {
        uint32 blockNumber = safe32(
            block.number,
            "Uni::_writeCheckpoint: block number exceeds 32 bits"
        );

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    function add96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }

    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        // XXX: added linter disable
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
