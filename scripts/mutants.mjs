#!/usr/bin/env node
/**
 * Breaks the application on purpose, four ways, and checks the suite notices.
 *
 * A test that cannot fail is worse than no test, because it costs the same to run
 * and buys nothing. The usual way to claim otherwise is a paragraph in a README
 * saying the tests were checked once, by hand, at some point. This runs it.
 *
 * Each mutant names a specific way login could be wrong. For each one the script
 * patches src/App.vue, runs the Chromium suite, records which tests failed, and
 * puts the file back. A mutant that leaves the suite green has SURVIVED, and that
 * is a defect in the tests - the script exits non-zero so CI says so.
 *
 *   npm run test:mutants
 *
 * On restoring the file: every path out of here goes through a finally, and the
 * script refuses to start unless git reports a clean tree, so a crash can never
 * be confused with someone's uncommitted work and an interrupted run can always
 * be undone with `git checkout -- src/App.vue`.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET = 'src/App.vue';

/**
 * Four mutants, hand-picked. Each is a plausible mistake rather than a random
 * character swap - see docs/adr/ADR-008 for why this is not Stryker.
 */
const MUTANTS = [
  {
    id: 'no-credential-check',
    what: 'Skip the credential check entirely - anyone gets in',
    expect: 'the rejection suite fails',
    find: 'const user = this.users.find(u => u.email === this.email && u.password === this.password);',
    replace: 'const user = this.users[0];',
  },
  {
    id: 'logout-keeps-session',
    what: 'Logout hides the view but keeps the stored session',
    expect: 'the logout tests fail',
    find: "localStorage.removeItem('logged');",
    replace: 'this.isLoggedIn = false;',
  },
  {
    id: 'wrong-identity',
    what: 'Sign everyone in as the first user, whoever they are',
    expect: 'the identity assertions fail',
    find: "localStorage.setItem('logged', user.email);",
    replace: "localStorage.setItem('logged', this.users[0].email);",
  },
  {
    id: 'reworded-message',
    what: 'Reword the rejection message',
    expect: 'only the test pinning the wording fails',
    find: "this.errorMessage = 'Invalid email or password. Please try again.';",
    replace: "this.errorMessage = 'Login failed.';",
  },
];

const original = readFileSync(TARGET, 'utf8');
const reportDir = mkdtempSync(join(tmpdir(), 'mutants-'));

function restore() {
  writeFileSync(TARGET, original);
}

function requireCleanTree() {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', TARGET], {
    encoding: 'utf8',
  }).trim();

  if (dirty) {
    console.error(
      `${TARGET} has uncommitted changes.\n\n` +
        'This script edits that file and puts it back afterwards. Refusing to run\n' +
        'while it is already modified, because a crash would leave you unable to\n' +
        'tell which edits were yours. Commit or stash first.',
    );
    process.exit(1);
  }
}

/** Runs the suite and returns { failed, titles }. */
function runSuite(label) {
  const jsonPath = join(reportDir, `${label}.json`);

  spawnSync('npx', ['playwright', 'test', '--project=chromium', '--reporter=json'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
    shell: process.platform === 'win32',
  });

  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const titles = [];

  // A test counts as failed only when its outcome differs from what was expected,
  // so the known-defect tests marked test.fail() are not mistaken for kills.
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const unexpected = spec.tests?.some((t) => t.status === 'unexpected');
      if (unexpected) titles.push(spec.title);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);

  return { failed: report.stats?.unexpected ?? titles.length, titles };
}

function main() {
  requireCleanTree();

  console.log('Checking the suite is green before breaking anything...');
  const baseline = runSuite('baseline');

  if (baseline.failed > 0) {
    console.error(
      `\nThe suite is already failing (${baseline.failed} tests) with no mutation applied.\n` +
        'Mutation results would be meaningless. Fix the suite first.',
    );
    process.exit(1);
  }
  console.log('Green.\n');

  const results = [];

  for (const mutant of MUTANTS) {
    process.stdout.write(`  ${mutant.id.padEnd(22)} `);

    if (!original.includes(mutant.find)) {
      console.log('SKIPPED - source no longer matches');
      results.push({ ...mutant, failed: null, titles: [], survived: true, stale: true });
      continue;
    }

    writeFileSync(TARGET, original.replace(mutant.find, mutant.replace));
    const { failed, titles } = runSuite(mutant.id);
    restore();

    const survived = failed === 0;
    console.log(survived ? 'SURVIVED' : `killed by ${failed}`);
    results.push({ ...mutant, failed, titles, survived, stale: false });
  }

  console.log('\n| Mutation | Expected | Actual |');
  console.log('|---|---|---|');
  for (const r of results) {
    const actual = r.stale
      ? '**source drifted — mutant no longer applies**'
      : r.survived
        ? '**SURVIVED — no test noticed**'
        : `${r.failed} failed`;
    console.log(`| ${r.what} | ${r.expect} | ${actual} |`);
  }

  const problems = results.filter((r) => r.survived);
  if (problems.length > 0) {
    console.error(
      `\n${problems.length} mutant(s) survived. Either a test that should cover this\n` +
        'behaviour has been weakened, or the mutant needs updating because the source moved.',
    );
    process.exit(1);
  }

  console.log('\nEvery mutant was caught. The tests can still fail.');
}

try {
  main();
} finally {
  // Belt and braces: main() restores after each mutant, but a throw anywhere
  // above must not leave the application broken on someone's working copy.
  restore();
  rmSync(reportDir, { recursive: true, force: true });
}
