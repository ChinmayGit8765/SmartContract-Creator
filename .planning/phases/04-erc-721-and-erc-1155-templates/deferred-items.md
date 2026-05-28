# Deferred / out-of-scope items — Phase 04

## Discovered during plan 04-03 (ERC-1155) execution

- **`npm run typecheck` reports 2 errors in `src/templates/erc721/index.ts`** (TS2307:
  cannot find `./wizard.js` / `./generate.js`). These belong to the parallel Wave 1 plan
  04-02 (ERC-721), whose `wizard.ts` / `generate.ts` had not landed in the shared working
  tree at the time 04-03 ran. OUT OF SCOPE for 04-03 — not fixed. All `src/templates/erc1155/`
  files typecheck clean (verified: `npm run typecheck | grep erc1155` → no matches).
  Plan 04-02 / 04-04 will resolve.
