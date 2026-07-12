# DeskLink

Android-to-Windows companion app (Microsoft Phone Link style). Sync notifications, SMS, photos, and clipboard over local Wi‑Fi.

## Projects

| App | Stack | Path |
|-----|-------|------|
| Desktop | Electron + React + TypeScript | [`desklink-desktop/`](desklink-desktop/) |
| Android | Kotlin + Jetpack Compose | [`desklink-android/`](desklink-android/) |

## Quick start

**Desktop** (Node 20+):

```bash
cd desklink-desktop
npm install
npm run dev
```

Or from the monorepo root: `npm run desktop:dev` (after `npm install` in `desklink-desktop`).

### Windows installer

```bash
cd desklink-desktop
npm install
npm run dist:win
```

Output: `desklink-desktop/release/DeskLink-Setup-0.1.0.exe`

Unpacked app (no installer): `npm run pack` → `release/win-unpacked/DeskLink.exe`

**Note:** The installer is unsigned (no code-signing certificate). Windows SmartScreen may show a warning — choose "More info" → "Run anyway". Allow DeskLink through the firewall on first launch (port 9847).

**Android** (Android Studio, API 26+):

1. Open `desklink-android` in Android Studio.
2. Run on a physical device on the same Wi‑Fi as your PC.

## Documentation

- [Architecture](docs/architecture.md) — system design and stage roadmap
- [Protocol](docs/protocol.md) — WebSocket event catalog
- [Testing checklist](docs/testing-checklist.md) — manual E2E verification
- [Troubleshooting](docs/troubleshooting.md) — pairing, firewall, and sync issues
- [Database schema](docs/database-schema.md) — persistence design (desktop uses JSON file store)

## Features (MVP)

- QR pairing over LAN (port 9847)
- **mDNS discovery** — find desktop without scanning QR (`_desklink._tcp`)
- Live notification sync
- SMS threads + reply from PC
- Recent photos grid + download
- Bidirectional clipboard (plain text)
- Per-feature sync toggles + unpair

See [Known MVP limitations](docs/architecture.md#known-mvp-limitations) for constraints.
