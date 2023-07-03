// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.4;

interface ISocialConnect {
    /**
    * @notice Returns identifiers mapped to `account` by signers of `trustedIssuers`
    * @param account Address of the account
    * @param trustedIssuers Array of n issuers whose identifier mappings will be used
    * @return countsPerIssuer Array of number of identifiers returned per issuer
    * @return identifiers Array (length == sum([0])) of identifiers
    * @dev Adds identifier info to the arrays in order of provided trustedIssuers
    * @dev Expectation that only one attestation exists per (identifier, issuer, account)
    */
    function lookupIdentifiers(address account, address[] calldata trustedIssuers)
    external view returns (uint256[] memory countsPerIssuer, bytes32[] memory identifiers);
}
