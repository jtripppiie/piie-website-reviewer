# Before After Design Review

A small no-database design review prototype.

## What it does now

- Admin login with one password
- Create review packets
- Add cover pages
- Add before/after image comparison pages
- Add dev/live URL review pages
- Share a reviewer link
- Reviewers can leave initials, status, and comments
- Feedback is saved to JSON files

## No database

This prototype stores data in:

- `data/packets.json`
- `data/responses.json`
- `data/uploads/`

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Then open:

```text
http://localhost:3000/admin
```

Default password is whatever you put in `.env`.

## Notes

This is a beginner scaffold. It is intentionally simple.

Cloud Run note: local file storage can disappear when a container restarts. For production, keep the same storage interface but swap the file storage layer for Google Cloud Storage.
