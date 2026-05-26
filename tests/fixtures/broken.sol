// SPDX-License-Identifier: MIT
// Deliberately broken fixture for Phase 3 compile-fail tests — DO NOT USE.
pragma solidity ^0.8.27;

contract Broken {
    uint256 x = ; // ParserError: expected expression
}
