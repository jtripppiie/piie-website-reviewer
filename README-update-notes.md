# Update notes

A short log of notable changes. See `README.md` for full setup and usage.

## Reviewer experience

- Full-width review deck with sticky top navigation.
- Wider before/after comparison area and a right-side feedback panel.
- More feedback statuses, plus a reviewer name/initials field.
- Comment dots you can pin to a specific spot on a comparison.
- Honest screen-size presets (Desktop, 15.6, 14.5, 13, Mobile) with a fit/scale
  control, since these are browser widths, not exact screen inches.

## URL review without iframes

Pantheon and many secure sites refuse to load inside an iframe. The app now
treats screenshots as the main review method and opens Dev/Live URLs in a new
tab instead of relying on embedding. URL pages can also auto-capture screenshots
at each screen size.

## Quick edit and sharing

- Triple-click a page heading on a review page to set URLs or upload images
  without opening admin.
- `npm run share` exposes the local server with a free Cloudflare tunnel.

## Install

```bash
npm install
cp .env.example .env
npm run dev
```
