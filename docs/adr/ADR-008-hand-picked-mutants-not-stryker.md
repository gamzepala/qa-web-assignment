# ADR-008: Four hand-picked mutants, not a mutation-testing framework

**Status:** accepted · **Date:** 2026-09-02

## Context

The strategy document claimed the tests had been checked against a deliberately
broken application. It was true, and it was unverifiable — a paragraph asserting
that someone once ran something. It had also already drifted once: a mutation run
against a single spec file was written up as though it were the whole suite, and
the conclusion drawn from it was the opposite of what the code did.

So the check needed to become a command. The obvious way to do that is Stryker,
which is the standard JS mutation-testing framework and would have been a shorter
sentence in the README.

## Decision

`npm run test:mutants` — a small script holding four hand-written mutants, each a
plausible way login could be wrong. No mutation-testing framework.

## Consequences

The four mutants are the ones a reviewer would actually ask about: skip the
credential check, keep the session on logout, sign everyone in as the first user,
reword the rejection message. Each names a specific bug and each has an expected
blast radius, so the output reads as a statement about the *suite* rather than a
score.

The script refuses to start unless `src/App.vue` is clean in git, restores the file
in a `finally`, and fails the build if any mutant survives — which is the whole
point, because a surviving mutant means an assertion somewhere has been weakened.
It runs nightly rather than per-push: four mutants each require a full suite run,
so it costs roughly five minutes.

The cost of not using a framework is that these four mutants are the only ones
that exist. Nothing here would notice if a fifth kind of bug became untested;
someone has to think of it and add it. That is a real limitation and it is the
trade being made.

## Alternatives considered

**Stryker** — rejected, and not on effort grounds. `App.vue` is about thirty lines
of logic. Whole-program mutation on a surface that small produces mostly equivalent
mutants — flipping a `!` in a branch that cannot be reached from the UI, mutating a
string that is never asserted on — and the honest response to each is "that mutant
is fine, ignore it". You get a percentage that has to be explained rather than four
rows that each say something. A mutation score is also the kind of number that
starts getting optimised for its own sake.

**Leaving the table hand-written** — rejected: it had already gone stale once, which
is the strongest possible argument against it.

**Running it on every push** — rejected: five minutes per push to detect something
that changes only when someone edits an assertion. Nightly catches it the next
morning, which is soon enough.
