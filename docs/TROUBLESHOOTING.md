# PIIE Web Reviewer Troubleshooting

## Port 3000 already in use

Run:

lsof -i :3000
kill -9 $(lsof -t -i:3000) 2>/dev/null || true
npm run dev

## Cannot POST error

Check that the route exists:

grep -n "pages/:pageId/update\|packets/:packetId/update" server.js

A working page update route should exist.

Test route example:

curl -i -X POST "http://localhost:3000/admin/packets/PACKET_ID/pages/PAGE_ID/update?key=change-me"

A working route should return 302 Found, not Cannot POST.

## Empty reply from server

This means Node probably crashed.

Start directly:

node server.js

Then repeat the request from another terminal and read the crash error.

## Useful local links

Admin:

http://localhost:3000/admin?key=change-me

Debug page:

http://localhost:3000/admin/debug?key=change-me

Health check:

http://localhost:3000/healthz

## Layout checks

Expected URL review layout:

Desktop:
Dev preview on top
Live preview below

Laptop:
Dev preview on top
Live preview below

Mobile:
Dev and Live side by side

Tablet:
Hidden

## iframe blocked

If Firefox shows a security warning inside the preview, the target site is blocking iframe embedding. Use uploaded screenshots for reliable review.
