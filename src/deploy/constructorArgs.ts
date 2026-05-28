// Phase 5 — fixture-locked constructor-argument builders (the #1 footgun guard).
//
// The constructor signature is fully determined by (standard, premint>0?, access
// mode, which roles exist). These builders were generated empirically from
// @openzeppelin/wizard@0.10.8 — the SAME package generate.ts calls — so the rendered
// deploy commands interpolate the EXACT --constructor-args the user's options produce.
//
// Rules (05-RESEARCH §Constructor-Arg Matrix):
//   - Ownable adds a single `initialOwner` (for ERC-20 it appears AFTER `recipient`).
//   - AccessControl (roles) → `defaultAdmin`, then `pauser` (if pausable), then
//     `minter` (if mintable), in that order.
//   - ERC-20 prepends `recipient` ONLY when premint > 0. premint=0 + no flags +
//     access=none ⇒ ZERO-arg constructor().
//   - ERC-721 access=none ⇒ no-arg constructor().
//   - ERC-1155 ALWAYS has an owner-ish arg: the wizard default updatableUri:true
//     forces Ownable(initialOwner) even at access=false; roles → (defaultAdmin,...).
//
// tests/deploy/ctorArgs.spec.ts locks these against the committed .sol fixtures.
// NEVER emit a real key/address — exampleValue is always the placeholder token.

import type { ConstructorArg, DeployFlags } from "./types.js";

/** All addresses use "<YOUR_WALLET_ADDRESS>" as exampleValue (never a real key). */
const ADDR = (name: string): ConstructorArg => ({
  name,
  type: "address",
  exampleValue: "<YOUR_WALLET_ADDRESS>",
});

/** AccessControl role-holder addresses, in the wizard's emission order:
 *  defaultAdmin, then pauser (if pausable), then minter (if mintable). */
export function rolesArgs(flags: DeployFlags): ConstructorArg[] {
  const out = [ADDR("defaultAdmin")];
  if (flags.pausable) out.push(ADDR("pauser"));
  if (flags.mintable) out.push(ADDR("minter"));
  return out;
}

export function erc20ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  const out: ConstructorArg[] = [];
  if (flags.premintNonZero) out.push(ADDR("recipient"));
  if (flags.access === "ownable") out.push(ADDR("initialOwner"));
  else if (flags.access === "roles") out.push(...rolesArgs(flags));
  return out; // premint=0 + access=none ⇒ [] ⇒ `constructor()`
}

export function erc721ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  if (flags.access === "ownable") return [ADDR("initialOwner")];
  if (flags.access === "roles") return rolesArgs(flags);
  return []; // access=none ⇒ no-arg ctor
}

export function erc1155ConstructorArgs(flags: DeployFlags): ConstructorArg[] {
  // updatableUri default forces Ownable even at access=none.
  if (flags.access === "roles") return rolesArgs(flags);
  return [ADDR("initialOwner")]; // none OR ownable ⇒ initialOwner
}
