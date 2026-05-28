// Re-exports the ERC-20 filename derivation for ERC-721 (CONTEXT Open Question 2 /
// RESEARCH A5 recommendation: re-export, not clone). The filename utility is a pure
// function — the duplicate-don't-extract rule (CONTEXT D-10) targets prompt code, not
// utility libraries, so a single shared implementation is correct here.
export { contractNameToFilename } from "../erc20/filename.js";
