// Filename derivation for the ERC-1155 template.
//
// Per RESEARCH A5: the `contractNameToFilename` algorithm is template-agnostic
// (PascalCase the name, strip leading digits, suffix `.sol`), so ERC-1155
// re-exports the ERC-20 implementation rather than duplicating it.
export { contractNameToFilename } from "../erc20/filename.js";
