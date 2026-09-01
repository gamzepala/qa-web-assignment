# Findings

Defects found while building the login test suite. Each one is covered by a test,
so none of them can quietly come back, and none of them can quietly stay fixed
without somebody noticing either.

Six are in the application. Three more are repository and tooling issues that
would have bitten whoever cloned this next; those are at the end.

A note on how the application defects are tested. Rather than assert the broken
behaviour, which would freeze the bug in place, each one is written as a
`test.fail()` — Playwright runs it, expects it to fail, and reports the suite as
passing. Fix the underlying problem and the test starts passing unexpectedly,
which turns the build red and forces someone to come back and delete the
annotation. It keeps the defect visible without keeping the build permanently
broken.

---

## A-1 · The content area is invisible after signing in

**Severity: high** · `css/style.css:128` · covered by
`e2e/tests/session.spec.ts` → *the content area should be visible once signed in*

Sign in and you get a navigation bar, a footer, and nothing at all between them.
The three paragraphs of content render into the DOM and are then hidden by CSS.

The cause is a leftover from the rewrite. In the original version,
`js/index.js` toggled visibility by hand:

```js
content.style.display = 'flex';   // js/index.js, checklogged()
```

so the stylesheet quite reasonably defaulted `.content` to `display: none`. The
Vue rewrite replaced that imperative toggle with `v-if="isLoggedIn"`, which
controls whether the element exists — but nobody removed the old default, and
nothing sets `display` any more.

```css
.content {
    display: none;      /* nothing overrides this any more */
}
```

**Suggested fix:** change it to `display: flex`. The `align-items` and
`justify-content` rules already sitting in that block are waiting for it, which is
a good sign this is what was intended.

---

## A-2 · The Sign Out item in the user menu can never be clicked

**Severity: medium** · `css/style.css:161` · covered by
`e2e/tests/session.spec.ts` → *the Sign Out item in the user menu should be usable*

Clicking the user icon is supposed to open a small dropdown with Sign Out in it.
The element does appear in the DOM when you click, but it is invisible and
unclickable, so the feature is dead.

Identical root cause to A-1. The stylesheet expects a class the old script used to
add:

```css
.logout        { display: none; }
.logout.active { display: flex; }
```

and `App.vue` now does this instead, never touching `active`:

```html
<div class="logout" v-if="showLogoutMenu" @click.stop="logOut">
```

So the element mounts and stays hidden. The separate Logout button still works,
which is presumably why this went unnoticed — there is a second way out, so
nothing appears broken unless you specifically try the menu.

**Suggested fix:** either bind the class, `:class="{ active: showLogoutMenu }"`, or
drop `display: none` from `.logout` and let `v-if` do the work on its own. The
second is tidier, since `v-if` already decides whether the element exists.

---

## A-3 · Any value in localStorage is accepted as a session

**Severity: high in principle, low here** · `src/App.vue:139` · covered by
`e2e/tests/session.spec.ts` → *accepts any value in the session key* and
`src/App.spec.js` → *treats any non-empty value as a valid session*

The signed-in check is a truthiness test on a string the user controls:

```js
const logged = localStorage.getItem('logged');
this.isLoggedIn = !!logged;
```

Typing `localStorage.logged = 'x'` into the browser console is a complete
authentication bypass. Nothing is validated, nothing is signed, and nothing
expires.

I have marked the severity carefully. For this app it is genuinely low impact:
there is no server, no real data, and nothing behind the login except three
paragraphs of placeholder text, so there is nothing to steal. But it is worth
recording, because the moment anything real goes behind that check the severity
becomes critical, and this is the sort of thing that gets carried forward from a
prototype without anyone revisiting it.

**Suggested fix:** nothing, while it stays a demo. If it ever gains a backend,
authentication needs to move to a server-issued token with an expiry, and the
client-side flag stops being the thing that grants access.

Unlike the others, this test asserts the behaviour as it is rather than as it
should be. It is tagged `@security-finding` and documents a limitation rather than
demanding a fix.

---

## A-4 · The Logout button fails the AA contrast minimum

**Severity: low** · `css/style.css:170` · covered by
`e2e/tests/a11y/login.a11y.spec.ts` → *the Logout button should meet the contrast
minimum*

White text on `#d9534f` measures **3.96:1**. WCAG AA asks for 4.5:1 at this size
(15.2px, normal weight). It is the only automated accessibility violation anywhere
in the app.

**Suggested fix:** darken the background to `#c9302c`, which clears the threshold
and is already in the stylesheet as the hover colour — so the button would simply
start out the shade it already turns into.

---

## A-5 · The failure message is never announced to a screen reader

**Severity: medium** · `src/App.vue:41` · covered by
`e2e/tests/a11y/login.a11y.spec.ts` → *the failure message should be announced to
a screen reader*

Get your password wrong and a message appears. If you cannot see the screen,
nothing happens at all: you press the button and the page sits there in silence,
with no indication of whether anything was submitted.

The banner is a plain div:

```html
<div v-if="errorMessage" class="error-message">
```

An automated scan cannot catch this, which is worth saying plainly — axe reports
the login page as completely clean. A scanner has no way to know that this element
appears in response to an action, so it has no reason to expect it to be
announced.

**Suggested fix:** `<div v-if="errorMessage" class="error-message" role="alert">`.
That is the entire change, and it would also give the test suite something stable
to bind to; the error banner is currently the one element in the whole suite
matched by a styling class, because there is nothing better available.

---

## A-6 · The signed-in page is a keyboard dead end

**Severity: medium** · `src/App.vue:4-33` · covered by
`e2e/tests/a11y/login.a11y.spec.ts` → *every interactive control in the nav should
be reachable by keyboard*

Tab through the page after signing in and you reach exactly one thing: the Logout
button. Home, Products, Contact and the user menu are all plain `<div>`s with click
handlers, so they have no role, no tab stop, and no keyboard activation.

```html
<div class="user-section" @click="toggleLogout">
```

The user menu is the one that actually matters, because it holds Sign Out. Between
this and A-2, that menu is unreachable by mouse *and* by keyboard.

The login form itself is fine, incidentally — it can be completed start to finish
on the keyboard, and there is a test covering exactly that.

**Suggested fix:** make them buttons. `<button class="user-section">` with the
existing styling gets keyboard focus, Enter and Space activation, and the right
role for assistive technology, at the cost of a `background: none; border: none`
in the CSS. The nav items are decorative today — they do not navigate anywhere —
so they can stay as they are until they do something, at which point they should
be links.

---

## R-1 · The lockfile pointed at an internal registry

**Severity: blocking** · `package-lock.json` · fixed in this branch

The committed `package-lock.json` resolved most of its packages from an internal
Nexus host rather than the public npm registry. Anyone running `npm ci` from
outside that corporate network — including every GitHub Actions runner, and
including whoever reviews this — got `ENOTFOUND` and could not install the project
at all.

Regenerated against `registry.npmjs.org`, which is the only change; the resolved
versions are the same.

Worth flagging separately: the original lockfile is still in this repository's
history, and history is public once the repository is. If the internal hostname
matters, that commit needs rewriting rather than just fixing the current file.

---

## R-2 · The preview server binds to IPv6 only

**Severity: medium** · `vite.config.js` · fixed in this branch

This one only showed up once the suite ran on more than one browser, and it is a
good illustration of why "it works on Chrome" is not the same as "it works".

Vite's preview server binds to the IPv6 loopback and nothing else:

```
TCP    [::1]:4173    LISTENING
```

Meanwhile `localhost` resolves to both stacks and the client picks. Chromium chose
`::1` every time and was reliably green. Firefox sometimes chose `127.0.0.1`,
found nothing there, and failed mid-run with `NS_ERROR_CONNECTION_REFUSED` — on a
different test each time, which is exactly what a genuine flake looks like from
the outside.

Both the server and the base URL now name `127.0.0.1` explicitly, so there is
nothing left for anyone to guess. Firefox and WebKit have run clean since.

---

## R-3 · Dead files from the pre-Vue version

**Severity: cosmetic** · not changed

Four files in the repository belong to the version that came before the Vue
rewrite and are no longer referenced by anything:

| File | Status |
|---|---|
| `js/index.js` | The old DOM-manipulating script. Superseded by `App.vue`. |
| `index-vue.html` | Near-duplicate of `index.html`. |
| `README-Vue.md` | Describes the Vue rewrite; overlaps the main README. |

`js/users.js` is *not* in this list — it is still imported by `js/users.test.js`
and by the test suite, deliberately, as the source of truth for credentials.

I have left these alone rather than delete them. They are application files rather
than test files, removing them is a judgement call that belongs to whoever owns
the repository, and nothing breaks by keeping them. Raising it seemed more useful
than either silently deleting or silently ignoring.

They are also the reason the credential duplication in A-3's neighbourhood is
worth watching: `src/App.vue` carries its own hand-typed copy of the same three
users that live in `js/users.js`. Nothing keeps those two in step. The test suite
reads from `js/users.js` specifically so that if they ever drift, the login tests
fail rather than quietly passing against a stale list.
