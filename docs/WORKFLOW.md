# PIIE Web Reviewer Workflow

## Local start

Run:

cd ~/projects/before-after
npm install
cp .env.example .env
npm run dev

Admin URL:

http://localhost:3000/admin?key=change-me

Debug URL:

http://localhost:3000/admin/debug?key=change-me

Health check:

http://localhost:3000/healthz

## Main workflow

1. Create a packet.
2. Add a cover page, screenshot comparison, or Dev/Live URL review page.
3. Edit existing pages from the packet edit screen.
4. Publish the packet.
5. Share the reviewer link.
6. Reviewers save notes by screen size.
7. Saved notes appear publicly in the review panel.

## Important notes

- This is a no-database app.
- Packet data is stored in data/packets.json.
- Review notes are stored in data/responses.json.
- Uploads are stored in data/uploads/.
- File inputs cannot be prefilled by the browser.
- GitHub Pages cannot host this app because it needs Node and Express.
- Pantheon may block iframe previews, so screenshots are the safest review method.

## Best live hosting option

Use a Node-capable host such as Google Cloud Run, Render, Railway, or Fly.

For quick testing, Cloud Run is fine. For production, local JSON and uploads should move to persistent storage.
