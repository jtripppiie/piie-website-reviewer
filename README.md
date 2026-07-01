# PIIE Web Reviewer

A small, no-database tool for reviewing website design and content changes. You
create "packets" of pages (before/after images or Dev vs Live URLs), share a
link, and reviewers leave notes pinned to specific spots. Everything is stored
in plain JSON files - no database to set up.

There are two versions of this app:

| Version | Where it runs | Can it save changes? |
|---|---|---|
| **The real app** (`server.js`) | Your computer, or any server | Yes - saves to JSON files on disk |
| **The demo** (`docs/`) | GitHub Pages (static) | No - notes save only in your browser |

Live demo: https://jtripppiie.github.io/piie-website-reviewer/

> The demo is just a public preview. Anything that changes packets, uploads
> images, or captures screenshots needs the real app.

---

## Quick start (run it on your computer)

```bash
npm install
cp .env.example .env      # then edit the passwords in .env
npm run dev
```

Open the admin page:

```text
http://localhost:3000/admin?key=YOUR_ADMIN_PASSWORD
```

`YOUR_ADMIN_PASSWORD` is whatever you set for `ADMIN_PASSWORD` in `.env`.

---

## Share it with others for free (no hosting bill)

This runs the app on your machine and gives you a public `https://` link using a
free Cloudflare tunnel. Your data stays on your computer.

```bash
npm run share
```

Watch the output for a line like `https://something.trycloudflare.com` - that is
the link to share. Press **Ctrl+C** to stop.

Notes:
- If the app is already running on `localhost:3000`, the share command reuses
  that running app instead of trying to start a second copy.
- The link works only while that terminal stays open.
- The URL changes each time you run it (that is how free quick tunnels work).
- Set real passwords in `.env` before sharing, since the link is public.

---

## The three kinds of pages

- **Cover page** - a title and intro for the packet.
- **Image compare** - upload a Before and an After image with a drag slider.
- **URL compare** - enter a Dev URL and a Live URL. Some sites block previews,
  so you can also upload (or auto-capture) screenshots for each screen size.

On URL compare pages, the admin edit screen has an **Upload screenshots by
screen size** section. When a site cannot be captured automatically, you can
hand-upload a Dev and Live screenshot for each size (Desktop, 15.6, 14.5, 13,
Mobile). Each screenshot also has a **View at 100%** link that opens it at its
true native size in a new tab.

## Review deck rules

These rules are intentional and should not be changed casually:

- A single **URL compare** page means one comparison: **Dev vs Live** only.
  That is exactly two URLs or two screenshot columns, not more.
- The app should not auto-create multiple URL compare pages for the default demo
  flow. The built-in test packet is meant to open with one URL comparison page.
- Review is **either URL or image**, not both at once. If a packet has at least
  one usable URL compare page, the review deck renders the URL compare pages and
  hides image compare pages from the review flow.
- If you want to review screenshots/photos instead, use a packet with no usable
  URL compare pages.

Current source of truth:

- Demo packet generation lives in [server.js](/home/jt/projects/before-after/server.js).
- Review deck selection lives in [views/review.ejs](/home/jt/projects/before-after/views/review.ejs).
- The local saved packet data lives in [data/packets.json](/home/jt/projects/before-after/data/packets.json), but that file is git-ignored.

---

## Reviewing and notes

- Drag anywhere on the comparison (the whole line, not just the round handle) to
  wipe between Before/After.
- Pick a screen size in the notes panel and leave a note for that specific
  screen size.
- The notes panel **follows along as you scroll** on wide screens, and has a
  **Collapse / Expand** button so it never covers the review work.
- Open **View all notes** (button on the cover page) to see every note grouped
  by page, then use **Download notes** to save them as a spreadsheet file you
  can open in Excel or Google Sheets. You can filter by page or status first,
  and the download respects that filter.

### Fast test packet

The admin dashboard includes **Create Test Packet**. It creates a published demo
packet immediately with:

- a cover page
- a built-in generic photo comparison page kept in the packet data for image testing
- one same-origin Dev vs Live demo page for the default review flow
- seeded review notes across multiple screen sizes

Important:

- The default review flow for the test packet is the single URL compare page.
- Because URL review takes precedence, the photo comparison page is hidden in
  the review deck for that packet.
- If you need to test photo review, create or edit a packet so it does not have
  a usable URL compare page.

Use the test packet when you want to verify the presentation flow without
setting up a real project first.

### Demo vs the real app

The GitHub Pages **demo** mirrors the look and feel but has no server, so a few
things differ on purpose:

- The demo's **View notes** opens an in-page panel (notes live only in your
  browser); the real app has a full **View all notes** page with filters and a
  spreadsheet download.
- Uploading images, capturing screenshots, and saving quick edits only work on
  the real app.


---

## Admin vs reviewers

- **Admin** is gated by a password passed as `?key=...`. Admins create packets,
  edit pages, upload images, capture screenshots, clear review results, and
  delete finished projects from the dashboard.
- **Reviewers** log in with a shared username/password (set in `.env`) and open
  the review link. They leave notes; they cannot reach admin.

When an admin opens a packet from the dashboard's **Review Link**, the app keeps
the admin key on the review page so **Back to admin**, **Clear review results**,
and the page-level edit actions stay available during review.

`Clear review results` only removes saved review notes for that packet. It does
not remove the packet itself or its screenshots. Use `Delete project` when you
are done with a review and want to remove the whole project from the admin list.

### Quick edit on the review page

On the real app, quick edit is now **admin-only**. In admin review mode, each
work page shows a small quick-edit panel where you can:

- set Dev and Live URLs
- upload Dev and Live screenshots
- upload Before and After images
- fill a sample review note for testing

That keeps reviewers focused on reviewing while still giving admins a fast way
to tune a packet without going back to the full edit screen.

### Hidden shortcuts on the GitHub Pages demo

The static demo keeps two helpers out of sight so regular viewers do not trip
over them. Hover shows a tooltip on each:

- **Triple-click the title** ("PIIE Web Reviewer") to toggle quick edit, where
  you can change the Dev/Live URLs for your own preview (saved in your browser
  only, not shared).
- **Triple-click the eyebrow line** ("Static GitHub Pages Demo") to show or hide
  the debug box.

---

## Configuration (`.env`)

```text
PORT=3000
ADMIN_PASSWORD=change-me          # admin key used in ?key=...
REVIEW_USERNAME=PIIE              # reviewer login name
REVIEW_PASSWORD=change-me-too     # reviewer login password
QUICK_EDIT_PASSWORD=              # optional, see below
```

In production (`NODE_ENV=production`) the app refuses to start unless
`ADMIN_PASSWORD`, `REVIEW_USERNAME`, and `REVIEW_PASSWORD` are all set, so there
are no default passwords on a live server.

`QUICK_EDIT_PASSWORD` is optional legacy config for the quick-edit gate. The
current review flow keeps quick edit in admin mode, so most setups can leave it
blank.

---

## Where data is stored

```text
data/packets.json     # the packets and their pages
data/responses.json   # reviewer notes
data/uploads/         # uploaded and captured images
```

These files are ignored by git. If you delete them, the app recreates empty ones
on the next start.

That matters for debugging: changing the generator in [server.js](/home/jt/projects/before-after/server.js)
does not rewrite an already-created packet in [data/packets.json](/home/jt/projects/before-after/data/packets.json).
If a demo packet already exists with bad page data, fix or delete that local
packet data as well.

---

## Deploying to an always-on server (optional, paid)

If you want a stable URL that stays up without your machine running, the repo
includes a `Dockerfile` and a Render blueprint (`render.yaml`). Render's free
tier wipes uploaded files on restart, so a small persistent disk (a paid plan)
is needed for data to survive. See `render.yaml` for the setup.

For a free always-on URL, the Cloudflare tunnel above is usually the better fit.

---

## Handy URLs

```text
/admin?key=PASSWORD        # admin dashboard
/r/<shareToken>            # a review link (reviewer login required)
/healthz                   # quick "is it running" check
/admin/debug?key=PASSWORD  # routes and runtime info
```

In practice, use the **Review Link** button from the admin dashboard when you
want admin review mode, because it opens the packet with the admin key attached.

---

## Project layout

```text
server.js            # the Express app and all routes
storage.js           # reads/writes the JSON data files
screenshot.js        # Puppeteer screenshot capture
views/               # EJS templates (admin, review, etc.)
public/              # CSS and browser JavaScript
docs/                # the static GitHub Pages demo (separate from the app)
share.sh             # local server + Cloudflare tunnel helper
Dockerfile           # container image for deploying
render.yaml          # Render deploy blueprint
```
