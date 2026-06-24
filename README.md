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
- The link works only while that terminal stays open.
- The URL changes each time you run it (that is how free quick tunnels work).
- Set real passwords in `.env` before sharing, since the link is public.

---

## The three kinds of pages

- **Cover page** - a title and intro for the packet.
- **Image compare** - upload a Before and an After image with a drag slider.
- **URL compare** - enter a Dev URL and a Live URL. Some sites block previews,
  so you can also upload (or auto-capture) screenshots for each screen size.

---

## Admin vs reviewers

- **Admin** is gated by a password passed as `?key=...`. Admins create packets,
  edit pages, upload images, capture screenshots, and clear results.
- **Reviewers** log in with a shared username/password (set in `.env`) and open
  the review link. They leave notes; they cannot reach admin.

### Quick edit on the review page (no admin needed)

On the real app, **triple-click any page heading** on a review page to toggle
"quick edit" mode. That reveals a small panel per page where you can set the
Dev/Live URLs or drop in images and save them straight to the packet - handy
when you do not want to open the admin screens. It also has a button to fill a
sample review note for testing.

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

`QUICK_EDIT_PASSWORD` is optional. Leave it blank and quick edit works for any
logged-in reviewer (the default). Set it and reviewers must enter that password
once per browser session before they can save quick edits, which is handy when
you share the link more widely but only want a few people changing pages.

---

## Where data is stored

```text
data/packets.json     # the packets and their pages
data/responses.json   # reviewer notes
data/uploads/         # uploaded and captured images
```

These files are ignored by git. If you delete them, the app recreates empty ones
on the next start.

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
