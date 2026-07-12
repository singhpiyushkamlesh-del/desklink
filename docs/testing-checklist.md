# DeskLink Testing Checklist

Manual end-to-end verification for the MVP. Run desktop (`npm run dev`) and Android on the **same Wi‑Fi** network.

## Prerequisites

- [ ] Desktop app starts (`npm run dev`) **or** installed build (`DeskLink-Setup-0.1.0.exe`)
- [ ] Android app installs on physical device (API 26+)
- [ ] Firewall allows inbound connections on desktop (Windows private network)

## Pairing

- [ ] Desktop → Pair Device → QR displays; network name shown (e.g. `DeskLink-MY-PC`)
- [ ] Android → **Find nearby desktops** → desktop appears in list → tap to pair (no QR)
- [ ] Android → Scan QR → pairing succeeds (fallback)
- [ ] Android → Permissions screen → grant required permissions
- [ ] Dashboard shows paired device name
- [ ] Connection state becomes `connected`

## Reconnect

- [ ] Kill and reopen Android app → reconnects automatically (auto-reconnect on)
- [ ] Toggle **Auto-reconnect** off on Android → disconnect Wi‑Fi → no retry loop
- [ ] Toggle auto-reconnect on → reconnects when network returns
- [ ] Desktop restart → Android reconnects when app is open

## Unpair

- [ ] Desktop Settings → Unpair → device removed, dashboard shows no device
- [ ] Android can pair again with new QR session
- [ ] Android Home → Unpair desktop → returns to pairing screen
- [ ] Desktop no longer accepts old session token (AUTH_FAILED on reconnect attempt)

## Notifications

- [ ] Android: notification access enabled for DeskLink
- [ ] Android: notification sync toggle on
- [ ] Post notification on phone → appears on desktop Notifications page within seconds
- [ ] Search and app filter work
- [ ] Toggle notification sync off → new notifications not forwarded

## SMS

- [ ] Android: SMS read/send permissions granted
- [ ] Desktop Messages → Refresh → thread list loads
- [ ] Select thread → messages load
- [ ] Send reply from desktop → appears on phone, status shows sent
- [ ] Disconnect phone → cached threads still visible; send shows error

## Photos

- [ ] Android: photos/media permission granted
- [ ] Desktop Photos → Refresh → grid with thumbnails
- [ ] Download photo → saves to userData, "Show in folder" works
- [ ] Disconnect → cached list remains; download requires connection

## Clipboard

- [ ] Clipboard sync enabled on both sides
- [ ] Copy text on PC → paste on phone (~1s delay)
- [ ] Copy text on phone → paste on PC
- [ ] Toggle off on either side → sync stops
- [ ] No infinite copy loop when syncing back and forth

## Settings & logs

- [ ] Desktop Settings → clipboard toggle persists after restart
- [ ] Desktop Settings → sync logs show connection and sync events
- [ ] Android Home → all sync toggles persist after restart

## Error states

- [ ] Dashboard shows amber banner when phone disconnected
- [ ] Messages/Photos/Notifications show error banner on failed refresh
- [ ] Pair Device shows error when QR generation fails

## Known limitations to verify (expected behavior)

- [ ] No sync over internet / different networks
- [ ] Large photo libraries are slow (chunked base64 over WebSocket)
- [ ] Android clipboard may not sync when app is fully backgrounded (OS restriction)
- [ ] SMS may fail on some OEMs with aggressive battery optimization
