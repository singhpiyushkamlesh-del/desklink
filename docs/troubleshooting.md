# DeskLink Troubleshooting

Common issues when pairing or syncing over local Wi‑Fi.

## Pairing fails / phone cannot connect

### mDNS discovery (recommended)

On Android, tap **Find nearby desktops** instead of scanning QR. The desktop advertises as `DeskLink-{PC name}` on your Wi‑Fi.

- Desktop app must be running (`npm run dev`).
- If the desktop shows "Waiting for pairing mode", refresh the QR or restart the app.
- Some routers block multicast between devices — use QR pairing as fallback.

### Same network

- Phone and PC must be on the **same Wi‑Fi** (not mobile data, not guest network isolated from LAN).
- Disable VPN on both devices during pairing.

### Wrong desktop IP in QR code

Windows PCs often have multiple adapters (Wi‑Fi, Ethernet, VMware, Hyper-V). DeskLink picks the best candidate automatically, but virtual adapters can confuse detection.

- On desktop **Pair Device** page, check the **Host** IP shown under the QR code.
- It should be a `192.168.x.x` or `10.x.x.x` address — not `127.0.0.1` or `169.254.x.x`.
- If wrong, disable unused virtual adapters in Windows Network settings and tap **Refresh QR**.

### Windows Firewall

Electron must accept inbound connections on port **9847**.

1. When Windows prompts, allow DeskLink on **Private** networks.
2. Or manually: Windows Security → Firewall → Allow an app → allow DeskLink/Electron for private networks.
3. Advanced: inbound rule for TCP port 9847.

### Pairing token expired

QR tokens expire after 5 minutes. Tap **Refresh QR** on desktop and scan again.

## Connected but sync not working

### Android permissions

Open DeskLink → **Permissions** and grant:

- Notification access (system settings)
- SMS read/send
- Photos/media
- Camera (for QR)
- Battery optimization exclusion (recommended)

### Sync toggles

On Android **Home**, ensure the relevant sync toggle is on (notifications, SMS, photos, clipboard).

### Desktop not running

The Android app connects to the desktop WebSocket server. Keep `npm run dev` (or the built app) running on your PC.

## Clipboard not syncing

- Enable clipboard sync on **both** desktop Settings and Android Home.
- Android 10+ restricts background clipboard access — keep DeskLink recently in foreground.
- Plain text only; images and rich content are not supported.

## SMS / photos errors

- **SMS:** Some OEMs block background SMS; exclude DeskLink from battery optimization.
- **Photos:** Grant media permission; large downloads need an active connection.
- **Cached data:** Desktop shows cached threads/photos when offline; live fetch requires connection.

## Unpair and start fresh

**Desktop:** Settings → Unpair → scan new QR.

**Android:** Home → Unpair desktop → scan new QR.

Old session tokens are invalidated on unpair.

## Still stuck?

1. Restart desktop app and Android app.
2. Tap **Reconnect now** on Android Home.
3. Check desktop **Settings → Sync logs** for errors.
4. Run through [testing-checklist.md](testing-checklist.md).
