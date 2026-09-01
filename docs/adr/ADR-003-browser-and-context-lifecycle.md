# ADR-003: One browser per worker, one context per test

**Status:** accepted · **Date:** 2026-09-01

## Context

This is the decision that quietly decides whether a suite still works at two
hundred tests. Launching a browser per test costs one to two seconds every time and
leaks processes if anything fails before teardown. Sharing one browser context
across tests is fast and gives no isolation at all.

It matters more than usual here because the app keeps its session in
`localStorage`. Without a clean slate per test, a signed-in test hands its session
to whatever runs next, and the failure shows up somewhere unrelated.

## Decision

Playwright's default lifecycle, stated explicitly in the config rather than left
implicit: the browser is created once per worker process, and each test gets a
fresh `BrowserContext`.

## Consequences

Isolation comes from the context, not the browser — a fresh context is a clean
cookie jar, clean storage and clean permissions for roughly one percent of the cost
of a new browser. Tests can run fully parallel, in any order, and any one of them
passes on its own.

Client-side isolation is free; server-side state would not be. There is no server
here, so the point is theoretical, but it is the thing that would need attention
first if one arrived.

The two tests that create their own contexts close them in a `finally`, so an
assertion failure cannot leak a browser process into the rest of the run.

## Alternatives considered

**A browser per test** — rejected: one to two seconds each, for isolation the
context already provides.
**A shared context** — rejected: sessions bleed between tests and the suite becomes
order-dependent.
