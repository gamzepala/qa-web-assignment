# ADR-007: Ship a container, and copy the source into it rather than mount it

**Status:** accepted · **Date:** 2026-09-01

## Context

Anyone reviewing this has to get Node and three browsers onto their machine
before they can watch a single test run, and then hope their Node version and
their browser build behave like mine did. That is a lot of setup to ask of
someone evaluating a take-home, and every version difference between their
machine and mine is a chance to see a failure that is not really there.

The suite is developed on Windows and runs in CI on Linux. Reviewers are on
macOS, most likely Apple Silicon. That is three platforms and no shared baseline.

## Decision

A `Dockerfile` on `mcr.microsoft.com/playwright:v1.62.1-noble`, with a
`compose.yaml` exposing one service per suite. The tag matches the
`@playwright/test` version in `package.json` exactly.

The image **copies** the project in and runs `npm ci` inside. It does not mount
the working directory. Only `playwright-report` and `test-results` are mounted,
so the report comes back out.

## Consequences

`docker compose run --rm e2e` works with nothing installed but Docker, and the
browser binaries are byte-identical to the ones CI uses.

Copying rather than mounting is the part worth explaining. A bind mount would
drag the host's `node_modules` into the container, and those are built for the
host's OS and architecture — a macOS arm64 `esbuild` binary inside a Linux
container fails in a way that takes a while to recognise for what it is.
`.dockerignore` excludes `node_modules` for the same reason. The cost is that a
code change needs a rebuild, which is quick because dependencies sit in an
earlier layer.

Two flags that are not obvious and are not optional. `ipc: host`, because
Chromium shares memory through `/dev/shm` and Docker's default 64MB is too small
— it crashes on larger pages, intermittently, which is the worst way for anything
to fail. And `init: true`, so a browser that dies mid-test has its children
reaped instead of accumulating across a run.

The pinned tag is a maintenance obligation: bumping Playwright means bumping the
`FROM` line in the same commit. Letting those drift is a classic source of
failures whose messages point nowhere near the cause, so the Dockerfile says so
in a comment.

Docker is not the debugging path. `--ui` mode and headed runs want a real
display, so interactive work stays native. This is for a clean reproducible run,
which is a different job.

## Verified

Built and executed before committing: 40 end-to-end, 12 component, 6
accessibility, and 120 across all three browsers, all passing inside the
container, with the HTML report arriving on the host.

## Alternatives considered

**No container** — rejected: it works, but it puts the burden of matching three
platforms on whoever is reading.
**Bind-mount the working directory** — rejected: host `node_modules` break inside
the container, and hiding that behind a named volume trades one confusing failure
for another.
**Build browsers into a plain `node` image** — rejected: reimplements what the
official image already does, and drifts from it.
