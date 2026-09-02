# Login test automation

Automated tests for the login functionality of this Vue 3 single-page app, built
with Playwright and TypeScript. The original brief is preserved in
[docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

**60 tests across three layers**, plus a GitHub Actions pipeline. Along the way the
suite found seven real defects in the application, which are written up in
[docs/FINDINGS.md](docs/FINDINGS.md).

## Running it

From a clean clone, with Node 20 or newer:

```bash
npm ci
npx playwright install --with-deps chromium
```

Then pick a suite. Playwright builds the app and starts its own server, so there
is nothing to run in another terminal.

```bash
npm test              # component tests, ~4s
npm run test:e2e      # the login suite on Chromium, ~1min
npm run test:a11y     # accessibility scan, ~30s
npm run test:report   # open the HTML report from the last run
```

If you would rather explore than watch a log scroll past, this is the one to use:

```bash
npx playwright test --ui
```

It gives you the test tree, a scrubbable timeline, and a DOM snapshot of the page
at every step, with the network and console alongside.

A few more, for completeness:

```bash
npm run test:e2e:smoke          # critical path only, desktop + mobile viewport
npm run test:e2e:all-browsers   # Chromium, Firefox and WebKit
npm run typecheck
```

### Or run it in Docker, with nothing installed

If you would rather not put Node and three browsers on your machine to look at
someone's assignment, everything runs in a container instead:

```bash
docker compose run --rm e2e            # the login suite
docker compose run --rm unit           # component tests
docker compose run --rm a11y           # accessibility scan
docker compose run --rm all-browsers   # Chromium, Firefox and WebKit
```

The first build pulls about 2GB and takes a few minutes; after that a run starts
in seconds. The HTML report is written to `./playwright-report` on your machine
either way, so you can open it normally once the container exits.

The image is `mcr.microsoft.com/playwright:v1.62.1-noble`, pinned to exactly the
Playwright version in `package.json` and carrying browsers built by the same
release — so the browser versions are identical to CI's, and identical to
whatever your colleague gets. It is multi-arch, so an Apple Silicon Mac pulls a
native arm64 image rather than emulating x86.

For actually debugging a test, use the native path and `npx playwright test --ui`.
Docker is the right tool for a clean, reproducible run; it is the wrong one for
poking at a browser interactively.

### Two things that look wrong and are not

**Six tests report as `✘` while the run still passes.** They are marked
`test.fail()` — Playwright runs them, expects them to fail, and the summary still
says everything passed. They are the real defects listed in
[FINDINGS.md](docs/FINDINGS.md), asserting the behaviour the app *should* have. If
someone fixes one, it flips to an unexpected pass and the build goes red, which is
how you find out the bug is gone. A skipped test would just rot quietly.

**`npm run test:a11y` needs Chromium installed**, which the setup above covers.

## What is covered

| Layer | Tests | What it proves |
|---|---|---|
| Component ([`src/App.spec.js`](src/App.spec.js)) | 11 | The branches inside `logIn`, `logOut` and `clearError`, in milliseconds, with no browser |
| End-to-end ([`e2e/tests/`](e2e/tests)) | 43 | A real person signing in, being turned away, and signing out, in a real browser |
| Accessibility ([`e2e/tests/a11y/`](e2e/tests/a11y)) | 6 | WCAG 2.0 and 2.1 A/AA, plus the keyboard and screen-reader checks a scanner cannot make |

That is 60 written for this assignment. `npm test` reports 12 rather than 11,
because it also runs the single pre-existing test in `js/users.test.js`.

The end-to-end tests break down as sign-in (7), rejected credentials (11), edge
cases and hostile input (10), error message behaviour (5), session lifetime (7),
and behaviour when browser storage is unavailable (3).

Why the coverage is shaped this way, what was left out and why, and the risk
ranking behind it are all in [docs/TEST-STRATEGY.md](docs/TEST-STRATEGY.md).

## How it is put together

```
playwright.config.ts       timeouts, projects, reporters, the app server
e2e/
  src/config/             the base URL and the timeout budget, in one place
  src/pages/              page objects - locators and actions
  src/fixtures/           console capture, network stubbing, session seeding
  src/testdata/           credentials and the invalid-input catalogue
  src/utils/              session reads, axe helpers
  tests/                  the specs
src/App.spec.js           component tests
Dockerfile, compose.yaml  the containerised run
docs/                     strategy, findings, decision records
```

To add a test, put it in `e2e/tests/`, import `test` and `expect` from
`e2e/src/fixtures/fixtures`, and reach for a page object rather than a raw
selector. The fixtures give you console capture and a hermetic network for free.

The decisions that shaped this — why Playwright and not BDD, why the tests run
against the production build, why sessions are seeded rather than clicked through
— are recorded in [docs/adr/](docs/adr).

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs six jobs. Typecheck
and component tests come back in under a minute with no browser installed. The
Chromium suite is the gate. The accessibility scan runs separately and is
deliberately not required, because an accessibility rule should never be the
reason a bug fix cannot ship.

Three more stay off the pull-request path, where they would cost more than they
return. Firefox and WebKit run on master, nightly and on demand. A job builds the
container image and runs the smoke suite inside it, because nothing else would
notice if that image stopped building. And a nightly flake check runs the suite
three times over with retries disabled, so a flaky test surfaces before it starts
eroding anyone's trust in a red build.

Traces, screenshots and video are kept for any failure and uploaded as artifacts,
so a CI failure can be diagnosed without reproducing it locally.

## What it found

Seven defects, in short:

- After signing in, the entire content area is invisible.
- The Sign Out item in the user menu can never be clicked.
- With site data blocked, a correct sign-in silently does nothing at all.
- Any value in `localStorage` is accepted as a valid session.
- The Logout button fails the AA contrast minimum.
- The failure message is never announced to a screen reader.
- The signed-in page is a keyboard dead end — one reachable control.

Each one, with evidence and a suggested fix, is in
[docs/FINDINGS.md](docs/FINDINGS.md).
