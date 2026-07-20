# Update notes

A short log of notable changes. See `README.md` for full setup and usage.

## Current v1.0 direction

- The primary workflow is Dev vs Live URL review with live iframe previews when
  the reviewed sites are embeddable.
- The default demo URL remains the Nelson Structural site.
- Admin also has a local testing mode that uses `public/demo/dev-home.html` and
  `public/demo/live-home.html` for a predictable same-origin dry run.
- Reviewers can work by screen size: Full desktop, 15.6 display,
  14.5 display, 13 display, and Mobile.

## Reliability and security

- Mutating requests are serialized so concurrent JSON read-modify-write cycles
  cannot silently overwrite packet or note changes in a single app process.
- Multipart admin authorization now runs before uploaded files are written,
  preventing rejected uploads from accumulating in `data/uploads`.
- Reviewer login return paths are limited to local app URLs, preventing an
  external redirect after sign-in.
- All password and cookie comparisons (admin key, admin login, reviewer login,
  reviewer cookie, quick-edit password and cookie) use a constant-time check to
  avoid leaking secrets through response timing.
- Baseline security headers are sent on every response: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: no-referrer`.
  The referrer policy also keeps the admin key out of the `Referer` header on
  outbound requests.
- Screenshot capture rejects non-http(s) URLs and private, loopback-exempt
  network ranges (including the `169.254.169.254` cloud metadata endpoint) as a
  basic SSRF guard. Same-origin local demo pages on loopback still capture.
- Screenshot capture now runs the slow headless-browser work outside the packet
  lock, so a long capture no longer blocks other packet edits. Only the final
  read-modify-write is serialized, and it re-reads fresh state so a concurrent
  edit is not clobbered.

## Reviewer experience

- Live Dev and Live previews can be viewed side by side in Interact mode.
- Compare mode stacks Dev over Live with a draggable slider.
- Annotate mode lets reviewers place note spots on the webpage preview.
- Notes are grouped by screen size and can be managed or downloaded from the
  notes view.
- The notes panel can collapse so the review area stays usable on desktop.

## Highlights and callouts

- URL compare pages now include **Find differences**.
- When both iframe previews are inspectable, the app compares visible page
  elements in the current viewport and draws blue difference boxes.
- Clicking an auto-detected difference starts a pinned note at that spot.
- Admins can add saved reviewer highlights from the edit packet screen.
- Saved highlights can be a translucent box, underline, or arrow.
- Clicking a saved admin highlight on the review page also starts a pinned note.

## Admin workflow

- The admin dashboard can create a local test packet with seeded notes and
  highlights.
- Packet edit pages include URL fields, screenshot fallbacks, capture tools,
  and reviewer highlight controls.
- Admin review mode keeps admin-only actions available from the review page.
- Starting a new round clears notes without deleting the packet.

## Screenshot fallback

- Screenshot capture and manual per-size uploads remain available for URL
  compare pages.
- Fallback screenshots are useful when a site is easier to review as a static
  capture or when a stable reference is needed.

## Install

```bash
npm install
cp .env.example .env
npm run dev
```
