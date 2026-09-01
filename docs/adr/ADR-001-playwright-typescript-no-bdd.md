# ADR-001: Playwright and TypeScript, without BDD

**Status:** accepted · **Date:** 2026-09-01

## Context

The app is JavaScript, the assignment is open about tooling, and the choice needed
to cover a browser suite, a component suite and accessibility without three
separate stacks.

Cucumber was the other serious option. BDD is a collaboration practice: its value
comes from non-technical people reading and helping write the scenarios.

## Decision

Playwright with TypeScript, and plain test files rather than Gherkin.

## Consequences

Tracing, parallelism, cross-browser and the axe integration all come from one tool
with one config. TypeScript catches a mistyped page-object method at compile time
rather than three minutes into a browser run.

Skipping Gherkin means no product owner will read these specs. That is an honest
description of the situation rather than a loss — nobody non-technical is involved
in this assignment, and a Gherkin layer nobody reads is indirection that costs
maintenance and returns nothing. The test names carry the readable intent instead.

## Alternatives considered

**Cucumber with Java or JS** — rejected: the collaboration audience BDD exists to
serve does not exist here.
**Cypress** — rejected: no WebKit, and a weaker parallelism and tracing story.
**Selenium** — rejected: everything above would have to be assembled by hand.
