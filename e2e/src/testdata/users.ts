import { users as appUsers } from '../../../js/users.js';

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Valid credentials come from js/users.js, not from anything the page tells us.
 *
 * That matters more than it looks. The app keeps a second, hand-copied list of
 * the same users inside src/App.vue. If those two ever drift - someone rotates a
 * password in one place and not the other - a suite that scraped its expectations
 * from the UI would happily stay green. Reading from js/users.js means the login
 * tests fail instead, which is the whole point of having an oracle that sits
 * outside the thing under test.
 */
export const validUsers: readonly Credentials[] = appUsers as Credentials[];

/** The account used wherever a test just needs "some valid user". */
export const standardUser: Credentials = validUsers[0];

/** A second valid account, for the tests that need two distinct identities. */
export const secondaryUser: Credentials = validUsers[1];

/**
 * The only fixture account whose password contains letters, so it is the only one
 * that can say anything about case sensitivity. Flipping the case of a numeric
 * password would produce the same string and the test would pass against any
 * implementation, which is no test at all.
 */
export const alphabeticPasswordUser: Credentials =
  validUsers.find((u) => /[a-z]/i.test(u.password)) ??
  (() => {
    throw new Error(
      'No fixture user has letters in their password, so the password ' +
        'case-sensitivity test cannot be meaningful. Update js/users.js or drop that test.',
    );
  })();

/**
 * Rejection cases, named so a failure report reads as a sentence rather than a
 * table of strings. Each one exists because it is a different way the credential
 * check could be written wrong.
 */
export const invalidCredentials: Record<string, Credentials & { why: string }> = {
  wrongPassword: {
    email: standardUser.email,
    password: 'definitely-not-the-password',
    why: 'a known user with the wrong password must not get in',
  },
  unknownEmail: {
    email: 'nobody@nowhere.test',
    password: standardUser.password,
    why: 'a valid password belonging to someone else must not admit an unknown user',
  },
  crossedCredentials: {
    email: standardUser.email,
    password: secondaryUser.password,
    why: 'credentials must be checked as a pair, not looked up independently',
  },
  swappedFields: {
    email: standardUser.password,
    password: standardUser.email,
    why: 'putting the password in the email box must not authenticate anyone',
  },
  emptyBoth: {
    email: '',
    password: '',
    why: 'an empty submission must be rejected, not treated as a match on empty strings',
  },
  emptyEmail: {
    email: '',
    password: standardUser.password,
    why: 'a password alone is not an identity',
  },
  emptyPassword: {
    email: standardUser.email,
    password: '',
    why: 'a known email with no password is the classic auth bypass',
  },
  whitespaceOnly: {
    email: '   ',
    password: '   ',
    why: 'whitespace is not a credential, and must not be trimmed into an empty match',
  },
};

/**
 * Inputs that probe how the form handles hostile or oversized text. None of these
 * should authenticate; what they are really checking is that the app rejects them
 * cleanly instead of crashing, hanging, or rendering the input as markup.
 */
export const hostileInputs = {
  /** Rendered as text, or the app has an XSS hole. */
  scriptTag: '<script>alert(1)</script>',
  /** Rendered as text; also proves the payload is not being interpreted as HTML. */
  imgOnError: '<img src=x onerror=alert(1)>',
  /** No backend here, so this is about the string being treated as a literal. */
  sqlish: "' OR '1'='1",
  /** Multi-byte characters must survive the round trip through the input. */
  unicode: 'ÄÖÜ-日本語-Ñ',
  emoji: '🔐🙂👍',
  /** Long enough to catch a naive length assumption without taking a minute to type. */
  veryLong: 'a'.repeat(10_000),
} as const;

/**
 * Credentials that are almost right. These pin down how strict the comparison is
 * today. The app does an exact === on both fields, so all of these are rejected;
 * the tests document that deliberately, because "we trim the email" and "we
 * lowercase the email" are both changes a developer might make without realising
 * it is a behaviour change.
 */
export const nearMissCredentials = {
  emailUppercased: {
    email: standardUser.email.toUpperCase(),
    password: standardUser.password,
  },
  emailPadded: {
    email: `  ${standardUser.email}  `,
    password: standardUser.password,
  },
  passwordPadded: {
    email: standardUser.email,
    password: ` ${standardUser.password} `,
  },
  passwordCaseFlipped: {
    email: alphabeticPasswordUser.email,
    password: alphabeticPasswordUser.password.toUpperCase(),
  },
} as const;

/** The exact copy the app shows for any rejected login. */
export const INVALID_LOGIN_MESSAGE = 'Invalid email or password. Please try again.';

/** The localStorage key the app uses to remember who is signed in. */
export const SESSION_KEY = 'logged';
