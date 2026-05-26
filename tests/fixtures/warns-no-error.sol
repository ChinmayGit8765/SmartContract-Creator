// SPDX-License-Identifier: MIT
// Deliberately-warns fixture for Phase 3 warning-pass-through tests.
pragma solidity ^0.8.27;

contract Warns {
    function unused() external pure returns (uint256) {
        uint256 dead;  // Warning: unused local variable
        return 42;
    }
}
