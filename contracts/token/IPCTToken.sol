//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "@ubeswap/governance/contracts/voting/TransferrableVotingToken.sol";

contract IPCTToken is TransferrableVotingToken {
    /// @notice The maximum supply of IPCT Tokens.
    uint96 public constant MAX_SUPPLY = 100_000_000e18;

    /**
     * @notice Construct a new IPCT token
     * Note: this contract doesn't specify an initial minter, so there is no way new
     * tokens can get created.
     * @param _initialOwner The initial account to grant all the tokens
     */
    constructor(address _initialOwner)
        TransferrableVotingToken("IPCTToken", "IPCT", 18, MAX_SUPPLY, _initialOwner)
    // solhint-disable-next-line no-empty-blocks
    {
        // Do nothing
    }
}
