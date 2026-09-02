# Test strategy

Why the suite is shaped the way it is, what it deliberately does not cover, and
what I would do next.

## What is under test

A Vue 3 single-page app with one feature: a login form. Three hard-coded accounts,
a session kept in `localStorage`, and a signed-in view with a logout button. No
backend, no network calls of its own, no routing.

That last part matters more than it sounds, because it decides what is worth
testing. There is no API to seed through, no server-side session to invalidate, no
error response to intercept, and no second page to deep-link into. Several
techniques I would normally reach for have nothing to attach to here, and I would
rather say so than perform them on an app that cannot benefit.

## How the coverage was chosen

I ranked candidate scenarios before writing any of them, by what would actually
hurt if it broke.

**P0 — an incident.** Someone who should get in cannot, or someone who should not
get in does. This is the entire product: if login is wrong, nothing else about the
app matters. Covered by the sign-in tests and the rejection tests, and it is the
one area where I care about the *identity* stored, not just that something
happened.

**P1 — angry users.** The session does not survive a refresh, logout does not
work, or the error message misleads. Covered by the session and error-message
suites.

**P2 — edge cases that ship quietly.** Whitespace, casing, unicode, oversized
input, hostile input. None of these is likely, all of them are cheap, and each one
pins down a behaviour that is currently undocumented and easy to change by
accident.

**P3 — cross-cutting quality.** Accessibility, mobile viewport, cross-browser.
Real value, lower urgency, and kept off the pull-request path where it costs more
than it returns.

Depth over breadth, throughout. Forty end-to-end tests that each name a bug they
would catch are worth more than a hundred that assert a page loaded.

## The layers, and why a test lives where it does

The general rule: if a behaviour can be proven below the browser, prove it below
the browser, and save the expensive tier for things that genuinely need a real
one.

**Component tests** (`src/App.spec.js`, 11 tests, about four seconds) go straight
at the branches inside `logIn`, `logOut` and `clearError`. They need no build, no
server and no browser. When one fails you know immediately it is the component's
logic and not the rendering, the CSS, or the environment.

**End-to-end tests** (`e2e/tests/`, 40 tests, about a minute) drive a real browser
through the things a real person does. They overlap the component tests on
purpose. The overlap is not waste: the component test proves the function is
correct, the browser test proves it is actually wired to the button.

**Accessibility tests** (`e2e/tests/a11y/`, 6 tests) run as a separate project so a
new axe rule can never block a functional merge.

### Where the expected value comes from

This is the part I would most want a reviewer to look at.

Valid credentials are imported from `js/users.js` — never read off the screen.
That matters because `src/App.vue` keeps its own hand-typed copy of the same three
accounts, and nothing keeps the two in step. A suite that scraped its expectations
from the page would stay green through any amount of drift. Reading from the
source file means the login tests fail instead.

The same thinking drives the session assertions. Every sign-in test checks two
independent things: that the UI moved to the signed-in view, and that
`localStorage` holds a session for *that specific person*. Checking only the first
would pass against an app that renders the logged-in screen without authenticating
anybody, and against one that signs everyone in as the first user in the list.

I verified this rather than assuming it. Signing everyone in as `users[0]` failed
exactly the two identity assertions and left the third passing, because that
account genuinely is user zero.

### Proving the tests can fail

A test that cannot fail is worse than no test, so I broke the app four ways and
checked what happened. Each row is the whole Chromium suite unless stated.

| Mutation | Expected | Actual |
|---|---|---|
| Removed the credential check entirely | The rejection suite fails | 19 of 21 failed; the 2 survivors correctly do not assert rejection |
| Logout hides the view but keeps the session | The logout tests fail | Exactly 2 failed, both logout tests |
| Sign everyone in as the first user | The identity assertions fail | Exactly 2 failed, the two other accounts |
| Reworded the error message | Only the test pinning the wording fails | 1 failed |

The last row is the one worth explaining, because the first time I ran it the
result was misleading and I had written the wrong conclusion from it.

I originally ran that mutation against `error-message.spec.ts` alone, saw one
failure out of five, and wrote that behavioural tests were properly decoupled from
the copy. They were not. The exact sentence was asserted with `toHaveText` in three
files, and because two of those sites sit inside `for` loops it expanded to roughly
sixteen tests. A one-word copy change would have turned three files red — the
opposite of what I had claimed, in the section I had just told the reader to look
at most closely.

The tests now assert that a rejection *is shown*, and the wording is pinned in
exactly one place, `error-message.spec.ts`. Those are two different questions and
only one of them is about the copy. The row above is a full-suite run against the
current code.

The reason this is written up rather than quietly corrected: a mutation table is
only worth anything if the numbers in it were actually observed, and the failure
mode I hit — running a mutation against one file and reporting it as though it were
the suite — is the easy way to produce a table that looks rigorous and is not.

## Coverage inventory

Every line is marked covered, not applicable, or deliberately out of scope. Nothing
is left blank, because a blank is indistinguishable from an oversight.

### Authentication

| Item | Status |
|---|---|
| Valid login lands on the right page with the right identity | Covered, all three accounts |
| Invalid credentials rejected, no session created | Covered |
| Known user, wrong password | Covered |
| Unknown user, valid password | Covered |
| One user's email with another's password | Covered |
| Email and password swapped | Covered |
| Empty email, empty password, both empty | Covered |
| Whitespace-only credentials | Covered |
| Locked or disabled account | Not applicable — no such concept in the app |
| Session expiry / idle timeout | Not applicable — sessions never expire |
| Concurrent sessions in two contexts | Covered |
| Logout destroys the session | Covered, and separately after a reload |
| Back button after logout | Out of scope — see below |

### Authorisation

| Item | Status |
|---|---|
| Protected content unreachable while signed out | Covered |
| Session value is trusted without validation | Covered as a documented finding (A-3) |
| Another user's resource by ID | Not applicable — no resources, no IDs |
| Admin route as a standard user | Not applicable — one role |

### Forms and validation

| Item | Status |
|---|---|
| Error message copy | Covered, pinned word for word |
| Error clears when either field is edited | Covered, both fields separately |
| Error absent on first load | Covered |
| Error does not survive a reload | Covered |
| Repeated submissions do not stack errors | Covered |
| Keyboard-only completion and tab order | Covered |
| Submit via Enter | Covered |
| Fields cleared after success | Covered |
| Boundary: 10,000 characters | Covered |
| Unicode and emoji round trip | Covered |
| Leading and trailing whitespace | Covered — rejected, no trimming |
| Case sensitivity, email and password | Covered |
| Client vs server validation | Not applicable — no server |

### Security-adjacent

| Item | Status |
|---|---|
| Script payload rendered as text, no dialog | Covered |
| SQL-style input treated as a literal | Covered |
| Password field masked | Covered |
| Password absent from page markup | Covered |
| Password absent from the console | Covered |
| Failure message does not reveal whether the account exists | Covered |
| Session cookie flags | Not applicable — no cookies, no server |
| Rate limiting after repeated failures | Out of scope — no such feature to test |

### Cross-cutting

| Item | Status |
|---|---|
| Accessibility scan, WCAG 2.0/2.1 A and AA | Covered, login and signed-in pages |
| Error state scanned separately | Covered |
| Keyboard reachability of nav controls | Covered as a finding (A-6) |
| Screen-reader announcement of errors | Covered as a finding (A-5) |
| Mobile viewport | Covered — smoke path on a Pixel 7 profile |
| Cross-browser | Covered — Chromium, Firefox, WebKit |
| Console free of errors during critical flows | Covered |
| Loading and empty states | Not applicable — nothing loads asynchronously |
| Server error states via route interception | Not applicable — no requests to intercept |
| Visual regression | Out of scope — see below |
| Performance budget | Out of scope — see below |

## Out of scope, and why

This is the section I would read first if I were reviewing someone else's
submission, so here it is with reasons rather than a list.

**Route interception for error, empty and loading states.** Normally the
highest-value technique available, and here there is nothing to intercept. The app
makes no requests of its own. The only network traffic is a font and an icon kit,
both of which the suite already stubs. Simulating a failing API against an app with
no API would be theatre.

**Browser back and forward behaviour.** The app has no routing — signing in and out
does not change the URL or push a history entry, so there is nothing meaningful to
go back to. I checked before deciding this rather than assuming it.

**Performance testing.** I considered Lighthouse and decided against it. The app is
one component in a 70KB bundle serving a static form, with no backend and no data
fetching. A budget assertion against it would pass regardless of what anyone
changed, which is precisely the kind of test that cannot fail. This becomes worth
doing the moment there is a backend or real data — see next steps.

**Visual regression.** Needs a pinned rendering environment to be anything other
than a flake generator, and would earn its place on a UI with more than two states.
The two layout defects that do exist (A-1 and A-2) were caught by functional
assertions instead, which is the cheaper way to have found them.

**Load and stress testing.** No server to load.

**Deleting the dead pre-Vue files.** `js/index.js`, `index-vue.html` and
`README-Vue.md` are unused. Removing application files felt like a decision for
whoever owns the repository rather than mine to make quietly, so it is written up
as R-3 instead.

## How it runs

Playwright's default lifecycle, stated explicitly because it is the thing that
breaks suites at scale: **one browser per worker, one fresh browser context per
test**. The context is the isolation boundary. It matters here specifically because
the app stores its session in `localStorage` — without a clean context per test, a
signed-in test would leak straight into the next one.

Tests run fully parallel. Nothing is shared, nothing is ordered, and any single
test passes on its own. In CI, workers are capped at two to match the runner.

Retries are set to one in CI and zero locally. Locally a failure should stay failed
so it gets fixed; in CI a single retry absorbs genuine infrastructure noise. The
nightly flake-check job runs with retries disabled precisely so that noise cannot
hide.

Timeouts live in one place, `e2e/src/config/env.ts`. They are generous on purpose.
A test that fails because the budget was tight rather than because the app broke is
the fastest way to teach a team to ignore a red build — and this bit me for real:
budgets set from Chromium timings were too tight for a cold Firefox start.

Every test runs with the browser console captured and off-origin requests stubbed.
On failure the console is attached to the report alongside a trace, a screenshot
and video, so a CI failure can be diagnosed without reproducing it.

### Where it runs

Three places, and they are meant to agree with each other.

Locally through npm, which is the right way to develop and the only way to use
Playwright's UI mode for debugging. In CI on Linux. And in a container, pinned to
the same Playwright release, which is what makes the first two comparable — the
browser a reviewer runs is the same build CI runs, on whatever machine they have.
The reasoning is in [ADR-007](adr/ADR-007-containerised-run.md).

The container is not the debugging path and is not meant to be. It is there so
that "it works on my machine" stops being a thing anyone has to say.

### Tags

`@smoke` marks the critical path — five tests spanning sign-in, rejection and
logout. It is a coherent product rather than a random subset: it includes at least
one authentication success and one failure, because a smoke suite that never checks
a rejection is not really checking login.

`@security-finding` marks the one test that documents current behaviour rather than
asserting correct behaviour, so it can be found and revisited.

## What I would do next

In order.

1. **Fix A-1 and A-2 and delete the two `test.fail()` annotations.** Two CSS lines.
   The tests are already written and will start passing the moment the fix lands.

2. **Add `role="alert"` to the error banner and `data-testid` attributes to the
   form.** These are the same request from two directions. The banner is currently
   the only element in the suite matched by a styling class, because there is
   nothing more stable to hold on to — and the attribute that would fix the test
   fragility is the same one that fixes the accessibility gap.

3. **Make the nav controls real buttons.** Closes A-6, and makes the Sign Out flow
   reachable for everyone rather than just mouse users.

4. **Trend reporting.** A single run cannot show a rising flake rate or a slowly
   growing runtime, and those are the two signals that predict a suite being
   abandoned. The nightly flake-check job produces the data; nothing currently
   keeps it.

5. **Performance, once there is something to measure.** When a backend arrives,
   capture LCP and the login round trip against a budget. Not before — see above.

6. **Revisit A-3 the moment anything real sits behind the login.** Today it is a
   documented limitation. The day there is a server, it is a critical defect, and
   the test that currently documents the behaviour should be rewritten to demand
   the opposite.
