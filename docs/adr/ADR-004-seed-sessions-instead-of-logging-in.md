# ADR-004: Seed the session directly instead of logging in through the UI

**Status:** accepted · **Date:** 2026-09-01

## Context

Tests about logout, session persistence and the signed-in view all need somebody
signed in first. The tempting way to arrange that is a `beforeEach` that fills in
the login form.

It is the most common way a suite ends up slow and misleading. Every test pays for
a full sign-in, and one bug in the login form turns a dozen unrelated tests red at
once, telling you nothing you did not already learn from the login tests.

## Decision

A `loggedInPage` fixture writes the session key straight into `localStorage` and
reloads. The login form is exercised only by the tests that are about the login
form.

## Consequences

Session tests start in about a tenth of the time and fail only for reasons that
belong to them. A broken login form fails the seven sign-in tests, which is exactly
the blast radius it should have.

The seeding happens after an initial page load rather than through
`addInitScript`, and that distinction turned out to matter. `addInitScript` re-runs
on *every* navigation, so the first version of this fixture handed the session
straight back to any test that signed out and refreshed — the logout tests reported
success no matter what the app did. Loading, writing the key, then reloading seeds
it exactly once and leaves reloads behaving the way they do for a real user.

The trade-off is that the fixture encodes an assumption about how sessions are
stored. If the app moved to a cookie or a token, this fixture is the thing that
would need rewriting. The test that documents the storage key existing at all
(finding A-3) would catch that immediately.

## Alternatives considered

**UI login in `beforeEach`** — rejected: slow, and one failure cascades everywhere.
**API seeding** — not available: there is no API.
**`storageState` for every test** — rejected as the general mechanism because page
objects are built on the default `page` fixture, so a separately created context
would point somewhere else. It *is* used in the two-context isolation test, where
a second context is the point.
