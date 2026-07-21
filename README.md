# PIIE Web Reviewer

A small, no-database tool for reviewing website design and content changes. You
create "packets" of pages (before/after images or Dev vs Live URLs), share a
link, and reviewers leave notes pinned to specific spots. Admins can also add
reviewer highlights, and inspectable Dev/Live pages can show lightweight
auto-detected difference boxes. Everything is stored in plain JSON files - no
database to set up.

There are two versions of this app:

| Version | Where it runs | Can it save changes? |
|---|---|---|
| **The real app** (`server.js`) | Your computer, or any server | Yes - saves to JSON files on disk |
| **The demo** (`docs/`) | GitHub Pages (static) | No - notes save only in your browser |

Live demo: https://jtripppiie.github.io/piie-website-reviewer/

Default demo page: https://nelsonengineeringalaska.com/

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

## Core workflow

1. Create or edit a packet in admin.
2. Add one Dev vs Live page with the URLs reviewers should compare.
3. Optionally add reviewer highlights so people know exactly where to look.
4. Open the packet for review and share the review link.
5. Reviewers choose a screen size, compare Dev/Live, and save notes.
6. Admins manage notes, download results, or start a new review round.

For the normal demo/default URL fields, the app uses the Nelson Structural site.
For clean internal testing, use **Create local test packet** from admin. That
packet uses the same-origin demo files in `public/demo/dev-home.html` and
`public/demo/live-home.html` so iframe preview, comparison, annotation,
highlights, and note workflows can be tested without depending on a third-party
site.

## The three kinds of pages

- **Cover page** - a title and intro for the packet.
- **Image compare** - upload a Before and an After image with a drag slider.
- **URL compare** - enter a Dev URL and a Live URL. Embeddable sites render as
  live side-by-side iframe previews with Interact, Compare, Annotate, and Find
  differences modes. If a specific site cannot be embedded or needs a static
  reference, you can also upload or auto-capture screenshots for each screen
  size.

On URL compare pages, the admin edit screen also has **Screenshot fallbacks by
screen size**. When you want static review assets, you can capture or hand-upload
a Dev and Live screenshot for each size (Full desktop, 15.6, 14.5,
13, Mobile). Each screenshot also has a **View at 100%** link that opens it at
its true native size in a new tab.

## Live Dev vs Live review

URL compare pages have four reviewer modes:

- **Interact** - show Dev and Live as separate live previews so reviewers can
  scroll and inspect them.
- **Compare** - stack Dev over Live with a draggable slider.
- **Annotate** - add a note spot directly on the live preview surface.
- **Find differences** - when both iframes are inspectable from the review page,
  highlight visible changed elements with blue boxes. Clicking a difference
  starts a pinned note at that spot.

Find differences is intentionally lightweight. It compares visible DOM/text/media
elements in the current viewport, groups nearby changes, and draws review boxes.
If a page cannot be inspected from the parent review page, the app leaves the
normal manual compare/review workflow intact.

## Reviewer highlights

Admins can add saved callouts from the edit packet page under **Reviewer
highlights**. Highlights are stored on the page and render for reviewers on the
matching screen size.

Supported callouts:

- translucent box
- underline
- arrow

Each highlight uses percentage-based position and size values, so it scales with
the preview area. Clicking a saved highlight on the review page pins a pending
note to that area, which makes highlights useful as "look here" guidance for the
team.

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

### Local test packet

The admin dashboard includes **Create local test packet**. It creates a
published demo packet immediately with:

- a cover page
- a built-in generic photo comparison page kept in the packet data for image
  testing
- one same-origin Dev vs Live demo page for the default review flow
- seeded reviewer highlights
- seeded review notes across multiple screen sizes

Important:

- The default review flow for the test packet is the single URL compare page.
- Because URL review takes precedence, the photo comparison page is hidden in
  the review deck for that packet.
- The local Dev/Live pages are intentionally different so Find differences and
  reviewer highlights have something real to show.
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
  edit pages, add reviewer highlights, upload images, capture screenshots,
  delete notes, start new review rounds, and delete finished projects from the
  dashboard.
- **Reviewers** log in with a shared username/password (set in `.env`) and open
  the review link. They leave notes; they cannot reach admin.

When an admin opens a packet from the dashboard's **Review Link**, the app keeps
the admin key on the review page so **Back to admin**, **Start new round**,
page-level edit actions, and admin-only note cleanup stay available during
review.

`Start new round` removes saved review notes for that packet. It does not remove
the packet itself, its URLs, its screenshots, or its reviewer highlights. Use
`Delete project` when you are done with a review and want to remove the whole
project from the admin list.

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

### Google Cloud Run deployment

The app supports two storage modes:

- `STORAGE_BACKEND=local` (the default) keeps using `data/packets.json`,
  `data/responses.json`, and `data/uploads`. This is the normal local testing
  mode and does not require a Google account or credentials.
- `STORAGE_BACKEND=google` stores packets and notes in Firestore and stores
  uploaded/captured images in a private Cloud Storage bucket. This is the mode
  used by Cloud Run.

The Google deployment intentionally starts with Cloud Run concurrency and
maximum instances both set to `1`. The existing admin routes perform short
read/modify/write operations, so this prevents two instances from overwriting
one another while still giving the app durable Firestore and Cloud Storage
persistence. Screenshot captures receive 2 CPUs, 2 GiB memory, a fifteen-minute
request timeout, and the second-generation execution environment.

Prerequisites:

1. Install and authenticate the Google Cloud CLI.
2. Create or select a billed Google Cloud project.
3. Make sure your account can enable APIs, create Firestore/Storage resources,
   create service accounts and secrets, and deploy Cloud Run services.

From the repository root, run:

```bash
export PROJECT_ID="your-google-project-id"
export REGION="us-east1"                 # optional
export FIRESTORE_LOCATION="nam5"         # optional; choose carefully
bash scripts/deploy-gcloud.sh
```

The setup script:

- enables Cloud Run, Cloud Build, Firestore, Cloud Storage, Artifact Registry,
  and Secret Manager APIs;
- creates the default Firestore Native database with delete protection when
  one does not exist;
- creates a private, uniform-access Cloud Storage bucket;
- creates a least-purpose Cloud Run service account;
- grants that account Firestore and bucket object access;
- adds new Secret Manager versions for the admin and reviewer credentials;
- builds from the included Dockerfile and deploys the Cloud Run service; and
- prints the deployed URL.

The bucket name defaults to `<PROJECT_ID>-piie-reviewer-uploads`. Override it
with `GCS_BUCKET` before running the script if that globally unique name is not
available.

#### Migrate existing local reviews

Deployment starts with empty cloud collections. To copy the current local JSON
files and uploads into the configured Google project, authenticate with
Application Default Credentials and run:

```bash
gcloud auth application-default login
export STORAGE_BACKEND=google
export GOOGLE_CLOUD_PROJECT="your-google-project-id"
export GCS_BUCKET="your-bucket-name"
export MIGRATE_CONFIRM=yes
npm run migrate:gcloud
```

Migration replaces the configured Firestore packet and response collections,
so the explicit confirmation flag is required. It does not delete or change
the local files. Set `FIRESTORE_COLLECTION_PREFIX` if multiple isolated app
environments share one project.

#### Continue testing locally

Local mode remains the default:

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Keep `STORAGE_BACKEND=local` in `.env`. Local packets, notes, screenshots, and
uploads continue to behave exactly as before. The `/healthz` response reports
`"storage":"local"` or `"storage":"google"` so you can confirm which backend
the running instance is using.

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
