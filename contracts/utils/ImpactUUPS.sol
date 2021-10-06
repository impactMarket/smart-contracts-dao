// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.5;

import "hardhat/console.sol";

contract ImpactUUPS {
    address implementation;

    constructor(address implementation_) {
        implementation = implementation_;
    }

    fallback() external payable {
        // delegate all other functions to current implementation
        (bool success, ) = implementation.delegatecall(msg.data);

        assembly {
            let free_mem_ptr := mload(0x40)
            returndatacopy(free_mem_ptr, 0, returndatasize())

            switch success
            case 0 {
                revert(free_mem_ptr, returndatasize())
            }
            default {
                return(free_mem_ptr, returndatasize())
            }
        }
    }
}
