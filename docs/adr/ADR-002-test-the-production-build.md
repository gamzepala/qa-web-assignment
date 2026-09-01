# ADR-002: Test the production build, not the dev server

**Status:** accepted · **Date:** 2026-09-01

## Context

The suite needs the app running. The obvious choice is `npm run dev`, which is what
everyone has open anyway.

Two problems with it. The dev server holds an HMR websocket open, which shows up as
network noise in the console checks and as a request that never settles. And it
serves unbundled source, so it is not what anybody actually ships.

## Decision

Playwright's `webServer` runs `npm run build && npm run preview` and waits for the
port before the first test.

## Consequences

Every run tests the built bundle. There is nothing to start in another terminal and
nothing to remember, on a laptop or a CI runner, which is most of what makes a
suite runnable from a clean clone.

It costs a few seconds of build time per run. Locally `reuseExistingServer` means
that is paid once rather than per invocation.

This forced one change to the app: `vite.config.js` gained an explicit `preview`
block. Preview inherits `server.open: true`, which tries to launch a desktop
browser — fine by hand, nothing to open on a CI runner. The same block later pinned
the host to `127.0.0.1`, for reasons in ADR-005's neighbourhood and written up as
finding R-2.

## Alternatives considered

**Dev server** — rejected: HMR noise, and not the artifact that ships.
**A separately deployed instance** — rejected: turns a clean clone into a
prerequisite hunt.
