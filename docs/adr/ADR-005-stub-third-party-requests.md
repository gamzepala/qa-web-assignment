# ADR-005: Stub third-party requests rather than block or allow them

**Status:** accepted · **Date:** 2026-09-01

## Context

The page pulls two things from the internet: a Font Awesome kit and a Google font,
the latter over plain `http`. Neither has anything to do with logging in, and both
are somebody else's uptime. Letting a login suite go red because a CDN had a bad
afternoon is not a trade anyone would accept if it were put to them directly.

The obvious answer is to abort every off-origin request. I tried that first, and it
broke the app in a way that would have been reported as a bug.

## Decision

Off-origin requests are intercepted. The font stylesheet is fulfilled with an empty
response. The icon kit is fulfilled with a few lines of CSS that give `.fas`
elements a `1em` box.

## Consequences

Runs are hermetic and slightly faster, and no external service can turn the suite
red.

The stub exists because of a specific discovery. The user menu in the nav bar is a
bare `<div>` whose only child is an icon, so its entire clickable area comes from
the glyph the kit injects. Block the kit outright and that div collapses to 0x0 and
becomes unclickable — the suite would have been breaking the app and then reporting
its own damage as a finding. The stub reproduces the one property the layout
depends on, that an icon occupies a box, and nothing else.

That the app's hit areas depend on a third-party CDN is itself worth knowing. It is
not a defect I have filed, because nothing observably breaks for a real user with
working internet, but it is the kind of thing that surfaces on a corporate network
with a strict proxy.

The accepted cost: this suite will not notice if Font Awesome starts failing in
production. That belongs in uptime monitoring, not in a login test.

## Alternatives considered

**Allow the real requests** — rejected: third-party uptime becomes a cause of red
builds.
**Abort everything off-origin** — rejected: breaks the user menu's hit area and
produces a false finding.
