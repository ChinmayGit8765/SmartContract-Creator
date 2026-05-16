# smartc

Generate compile-verified smart contracts from a wizard.

> Status: pre-alpha. Phase 1 scaffold only — no template generation yet.

## Install

Requires Node.js 20 or newer.

```sh
npm install
```

## Develop

Run the CLI directly from TypeScript sources:

```sh
npm run dev
```

Typecheck without emitting:

```sh
npm run typecheck
```

## Build

Bundle to `dist/cli.js` (single ESM file with `#!/usr/bin/env node` shebang):

```sh
npm run build
node dist/cli.js
```

To install the `smartc` binary globally from this repo:

```sh
npm link
smartc
```

## Test

```sh
npm test          # one-shot
npm run test:watch
```
