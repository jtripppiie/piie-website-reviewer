# Wide Review Update

This update changes the reviewer experience.

## Main changes

- Full-width review deck
- Sticky top reviewer navigation
- Wider before/after comparison area
- Right-side feedback panel
- More feedback statuses
- Reviewer name/initials field
- Comment dots on screenshot comparisons
- URL review no longer depends on iframe embedding
- Dev and Live URLs open in a new tab
- Optional Dev and Live screenshots can be uploaded for URL comparison pages

## Why iframe was changed

Pantheon and many secure sites block being embedded inside another site. Firefox correctly refuses to display those pages in iframes. The app now treats screenshots as the primary review method and URLs as open-in-new-tab references.

## How to install

From the repo root:

```bash
unzip -o before-after-wide-review-update.zip -d .
npm run dev
```
