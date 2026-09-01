# ADR-006: Record known defects as expected failures

**Status:** accepted · **Date:** 2026-09-01

## Context

The suite found five defects that are real but not mine to fix — three
accessibility gaps and two CSS bugs from the pre-Vue rewrite. Each one needed a
home, and the usual three options are all bad in a different way.

Assert the broken behaviour and you have written the bug into the specification;
the day someone fixes it, your test fails and the fix looks like the problem. Skip
the test and it rots silently, and nobody ever finds out the bug is gone. Leave the
test failing and the build is permanently red, which within a fortnight means
nobody reads it.

## Decision

Each one is written to assert the behaviour the app *should* have, and marked
`test.fail()`.

## Consequences

Playwright runs the test, expects it to fail, and reports the suite as passing. The
defect stays visible in every report rather than hiding in a backlog.

The useful half is what happens on a fix. The test starts passing unexpectedly,
Playwright treats that as a failure, and the build goes red until someone removes
the annotation. The bug cannot be quietly fixed any more than it can be quietly
ignored — and the person who fixes it gets told, by the suite, that they are done.

The cost is that a reader who does not know the convention sees five `✘` marks next
to a passing run and assumes something is wrong. That is a documentation problem,
so it is called out in the README, in FINDINGS.md, and in a comment on each test.

One test is deliberately *not* written this way. The session-trust finding (A-3)
asserts the current behaviour and passes, because for this app the behaviour is an
accepted limitation rather than a bug to be fixed. It is tagged
`@security-finding` so it can be found and revisited the moment there is a real
backend, at which point it should be inverted.

## Alternatives considered

**`test.skip`** — rejected: silent, and never tells you when the bug is gone.
**Assert the broken behaviour** — rejected: turns the defect into the specification.
**Leave them failing** — rejected: a permanently red build is a build nobody reads.
