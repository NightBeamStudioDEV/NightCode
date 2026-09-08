# Contributing

Use Windows x64 and Node.js 22 or newer. Run `npm ci`, then `npm start`. `npm run dev` starts only the renderer server.

## Structure

- `src/`: React interface, shared contracts, and presentation helpers.
- `electron/`: IPC, engine, authenticated tool bridge, permissions, storage, and verification.
- `resources/agent-skills/`: bundled workflows and catalog.
- `tests/`: unit tests for behavior and safety boundaries.
- `e2e/`: Electron/OpenCode integration using local model fixtures.
- `docs/benchmarks/`: measurement data and methodology.

Keep changes focused. Add regression tests for behavior changes, run `npm test` and relevant integration tests, then `npm run build`. Use `NIGHTCODE_TEST_DATA` to isolate a development profile when exercising credential or file workflows.

Never commit databases, keys, conversation exports, personal paths, or build outputs. Keep sensitive security reports out of public issues.

## Release checks

Run `npm run package`, `npm run verify:package`, and `npm run smoke:package`. Packages are a Windows installer and portable executable; this project does not produce Java JARs.

For performance claims, retain task definitions, actual measurements, provider settings, exclusions, and limitations. Compare matching task sets and label harness versions.
